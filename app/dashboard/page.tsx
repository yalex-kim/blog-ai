'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { parseImageSuggestions } from '@/lib/parse-image-suggestions';
import { ArticleBody } from '@/components/ArticleBody';
import { ToastViewport, useToasts } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { btnGhost, btnPrimary, btnSecondary } from '@/lib/ui';
import { getVertical } from '@/lib/verticals/registry';
import { IMAGE_TYPES, resolveImageType } from '@/lib/verticals/types';
import type { KeyStatus } from '@/lib/tenant-keys';

/** Category name → topics. The keys come from the tenant's vertical pack. */
type Topics = Record<string, string[]>;

interface ImageSuggestion {
  id: string;
  type: string;
  description: string;
  text: string;
}

interface BlogResult {
  content: string;
  imageKeywords: string[];
  imageSuggestions?: ImageSuggestion[];
}

interface GeneratedImage {
  keyword: string;
  text?: string;
  url: string;
  prompt: string;
  type?: string;
}

interface EditableImagePrompt {
  id: string;
  type: string;
  description: string;
  text: string;
}

interface SavedPost {
  id: string;
  title: string;
  topic: string;
  content: string;
  image_keywords: string[];
  created_at: string;
  images?: GeneratedImage[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [tenantName, setTenantName] = useState('');
  const [category, setCategory] = useState('');
  // The vertical pack supplies the topic categories, image slot labels, and
  // which slots take overlay text — all of which differ by industry.
  const [vertical, setVertical] = useState<string | null>(null);
  const pack = getVertical(vertical);
  const [topics, setTopics] = useState<Topics | null>(null);
  const [loadingTopics, setLoadingTopics] = useState(false);

  const [customTopic, setCustomTopic] = useState('');
  const [generatingBlog, setGeneratingBlog] = useState(false);
  const [blogResult, setBlogResult] = useState<BlogResult | null>(null);
  const [currentTopic, setCurrentTopic] = useState('');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [regeneratingIndices, setRegeneratingIndices] = useState<Set<number>>(new Set());
  const [imagePrompts, setImagePrompts] = useState<EditableImagePrompt[]>([]);
  const [editingPrompts, setEditingPrompts] = useState(false);
  const [imageProvider, setImageProvider] = useState<string>('openai');
  const [imageQuality, setImageQuality] = useState<'low' | 'medium' | 'high'>('low');

  // New states for saved posts
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [currentPostId, setCurrentPostId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [pendingRegenIndex, setPendingRegenIndex] = useState<number | null>(null);

  // Which providers the tenant has a key for. Generation is refused without
  // one, so this is read up front to warn before a click is wasted rather than
  // only after the request comes back 400.
  const [keyStatuses, setKeyStatuses] = useState<KeyStatus[]>([]);
  const [apiKeyNotice, setApiKeyNotice] = useState<string | null>(null);

  const hasKey = (provider: string) =>
    keyStatuses.some((status) => status.provider === provider && status.configured);
  // Empty until the first fetch resolves; don't warn about a key we haven't looked up yet.
  const keysLoaded = keyStatuses.length > 0;

  const { toasts, showToast, dismiss } = useToasts();

  const fetchTenantInfo = async () => {
    try {
      const response = await fetch('/api/tenant/settings');
      if (response.ok) {
        const data = await response.json();
        setTenantName(data.tenant.name || '');
        setCategory(data.tenant.category || '');
        setVertical(data.tenant.vertical ?? null);
        setKeyStatuses(data.apiKeys ?? []);
      } else if (response.status === 401) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Error fetching tenant info:', error);
    }
  };

  const fetchSavedPosts = async () => {
    try {
      const response = await fetch('/api/blog-posts');
      if (response.ok) {
        const data = await response.json();
        setSavedPosts(data.posts);
      }
    } catch (error) {
      console.error('Error fetching saved posts:', error);
    }
  };

  useEffect(() => {
    fetchTenantInfo();
    fetchSavedPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      // When user presses back, return to initial state
      setBlogResult(null);
      setGeneratedImages([]);
      setCurrentTopic('');
      setCurrentPostId(null);
      setIsEditMode(false);
      // Refresh saved posts to show newly created content
      fetchSavedPosts();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const fetchTopicRecommendations = async () => {
    setLoadingTopics(true);
    try {
      const response = await fetch('/api/topics/recommend', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setTopics(data.topics);
      }
    } catch (err) {
      console.error('Error fetching topics:', err);
    } finally {
      setLoadingTopics(false);
    }
  };

  const loadSavedPost = (post: SavedPost) => {
    console.log('Loading saved post:', post);
    console.log('Image keywords:', post.image_keywords);
    console.log('Saved images:', post.images);

    // Extract image suggestions from content if they exist (new format with IDs)
    const imageSuggestions: ImageSuggestion[] = parseImageSuggestions(post.content);

    console.log('Extracted image suggestions from content:', imageSuggestions);

    const blogData = {
      content: post.content,
      imageKeywords: post.image_keywords || [],
      imageSuggestions: imageSuggestions.length > 0 ? imageSuggestions : undefined,
    };

    console.log('Setting blogResult to:', blogData);
    setBlogResult(blogData);
    setCurrentTopic(post.topic);
    setCurrentPostId(post.id);
    setEditedContent(post.content);
    setIsEditMode(false);
    setCopied(false);

    // Initialize image prompts from suggestions
    setImagePrompts(imageSuggestions.length > 0 ? imageSuggestions : []);
    setEditingPrompts(false);

    // Load saved images if they exist and place them at correct indices
    if (post.images && post.images.length > 0 && imageSuggestions.length > 0) {
      // Create array with empty slots matching prompts count
      const imageArray: GeneratedImage[] = new Array(imageSuggestions.length);

      // Place each image at its correct index based on displayOrder
      post.images.forEach((img: GeneratedImage & { displayOrder?: number; promptId?: string }) => {
        if (img.displayOrder !== undefined && img.displayOrder >= 0 && img.displayOrder < imageArray.length) {
          imageArray[img.displayOrder] = img;
        }
      });

      setGeneratedImages(imageArray);
    } else {
      setGeneratedImages([]);
    }

    // Add to browser history so back button works
    window.history.pushState({ view: 'post' }, '');
  };

  const generateBlog = async (topic: string) => {
    setGeneratingBlog(true);
    setBlogResult(null);
    setGeneratedImages([]);
    setCurrentTopic(topic);
    setCurrentPostId(null);
    setIsEditMode(false);
    setCopied(false);

    try {
      const response = await fetch('/api/generate-blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });

      if (response.ok) {
        const data = await response.json();
        setBlogResult(data);
        setEditedContent(data.content);
        // Set the blog post ID for new posts
        if (data.blogPostId) {
          setCurrentPostId(data.blogPostId);
        }
        // Initialize image prompts from suggestions (limit to 5)
        const suggestions = data.imageSuggestions || [];
        setImagePrompts(suggestions.slice(0, 5));
        setEditingPrompts(false);
        // Refresh saved posts list
        fetchSavedPosts();
        // Add to browser history so back button works
        window.history.pushState({ view: 'post' }, '');
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        if (errorData.code === 'MISSING_API_KEY') {
          // A 4-second toast cannot carry the "go to settings" action, so the
          // missing-key case gets the persistent banner instead.
          setApiKeyNotice(errorData.error);
          fetchTenantInfo();
        } else {
          showToast('error', errorData.error || '블로그 생성에 실패했습니다.');
        }
      }
    } catch (error) {
      console.error('Error generating blog:', error);
      showToast('error', '블로그 생성 중 오류가 발생했습니다.');
    } finally {
      setGeneratingBlog(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!currentPostId) return;

    try {
      const response = await fetch('/api/blog-posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentPostId,
          content: editedContent,
        }),
      });

      if (response.ok) {
        // Re-parse image prompts from edited content
        const imageSuggestions: ImageSuggestion[] = parseImageSuggestions(editedContent);

        // Update blog result and image prompts
        setBlogResult({ ...blogResult!, content: editedContent, imageSuggestions });
        setImagePrompts(imageSuggestions);
        setIsEditMode(false);
        showToast('success', '저장되었습니다.');
        fetchSavedPosts();
      } else {
        showToast('error', '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error saving edit:', error);
      showToast('error', '저장 중 오류가 발생했습니다.');
    }
  };

  const toggleEditMode = () => {
    if (isEditMode) {
      // Cancel edit - revert to original
      setEditedContent(blogResult?.content || '');
    }
    setIsEditMode(!isEditMode);
  };

  const handleGenerateImages = async () => {
    // Use imagePrompts (limited to 5)
    if (imagePrompts.length === 0) {
      showToast('error', '이미지 프롬프트가 없습니다.');
      return;
    }

    setGeneratingImages(true);

    try {
      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: imagePrompts,
          topic: currentTopic,
          blogPostId: currentPostId,
          imageProvider,
          imageQuality,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedImages(data.images);
        // Refresh saved posts to update with newly generated images
        fetchSavedPosts();
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        if (errorData.code === 'MISSING_API_KEY') {
          setApiKeyNotice(errorData.error);
          fetchTenantInfo();
        } else {
          showToast('error', `이미지 생성에 실패했습니다. ${errorData.error || ''}`.trim());
        }
      }
    } catch (error) {
      console.error('Error generating images:', error);
      showToast('error', '이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setGeneratingImages(false);
    }
  };

  // Overwriting an existing image needs confirmation; generating into an
  // empty slot doesn't. The dialog is driven by pendingRegenIndex.
  const handleRegenerateImage = (index: number) => {
    if (generatedImages[index]) {
      setPendingRegenIndex(index);
      return;
    }
    void regenerateImage(index);
  };

  const regenerateImage = async (index: number) => {
    const prompt = imagePrompts[index];

    // Add index to regenerating set
    setRegeneratingIndices(prev => new Set(prev).add(index));

    try {
      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: prompt.description,
          text: prompt.text || '',
          // Without this the API can't tell INTRO from INFOGRAPHIC and falls
          // back to MEDICAL styling for every regenerated image.
          type: prompt.type,
          topic: currentTopic,
          index,
          blogPostId: currentPostId,
          replaceExisting: true,
          promptId: prompt.id,
          imageProvider,
          imageQuality,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newImages = [...generatedImages];
        newImages[index] = data.image;
        setGeneratedImages(newImages);
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        if (errorData.code === 'MISSING_API_KEY') {
          setApiKeyNotice(errorData.error);
          fetchTenantInfo();
        } else {
          showToast('error', `이미지 재생성에 실패했습니다. ${errorData.error || ''}`.trim());
        }
      }
    } catch (error) {
      console.error('Error regenerating image:', error);
      showToast('error', '이미지 재생성 중 오류가 발생했습니다.');
    } finally {
      // Remove index from regenerating set
      setRegeneratingIndices(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  // Confirms inline on the button itself rather than interrupting with a
  // dialog for what is a trivially reversible action.
  const handleCopyAll = async () => {
    if (!blogResult?.content) return;
    try {
      await navigator.clipboard.writeText(blogResult.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying content:', error);
      showToast('error', '복사에 실패했습니다. 직접 선택해 복사해주세요.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // In the result view the two columns scroll independently, which needs a
  // bounded height to scroll *within* — so the shell becomes a viewport-tall
  // flex column. Below lg (and in the topic view) the page scrolls normally.
  const isResultView = blogResult !== null;

  return (
    <div className={`min-h-screen bg-paper ${isResultView ? 'lg:h-screen lg:overflow-hidden lg:flex lg:flex-col' : ''}`}>
      <header className="bg-surface shadow lg:flex-none">
        <div className={`mx-auto px-4 py-4 flex justify-between items-center ${isResultView ? 'max-w-[1632px]' : 'max-w-6xl'}`}>
          <div>
            <h1 className="text-2xl font-bold text-ink">{tenantName || 'Blog AI'}</h1>
            <p className="text-sm text-ink-faint">{category}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/dashboard/usage')}
              className={`${btnGhost} px-4 py-2`}
            >
              사용량
            </button>
            <button
              onClick={() => router.push('/settings')}
              className={`${btnGhost} px-4 py-2`}
            >
              설정
            </button>
            <button
              onClick={handleLogout}
              className={`${btnGhost} px-4 py-2`}
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main
        className={`mx-auto px-4 w-full ${
          isResultView
            ? 'max-w-[1632px] py-6 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col'
            : 'max-w-6xl py-8'
        }`}
      >
        {(apiKeyNotice || (keysLoaded && !hasKey('anthropic'))) && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-card px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold text-yellow-900 mb-1">API 키가 필요합니다</p>
              <p className="text-sm text-yellow-800">
                {apiKeyNotice ??
                  '글을 생성하려면 본인의 Anthropic API 키를 등록해야 합니다. 생성 요금은 등록한 키로 청구됩니다.'}
              </p>
            </div>
            <button
              onClick={() => router.push('/settings')}
              className={`${btnPrimary} px-4 py-2 text-sm whitespace-nowrap`}
            >
              키 등록하러 가기
            </button>
          </div>
        )}

        {!blogResult ? (
          <>
            {/* Greeting */}
            <div className="bg-surface rounded-card shadow-card p-6 mb-6">
              <h2 className="text-xl font-semibold mb-2">
                안녕하세요, {tenantName}님!
              </h2>
              <p className="text-ink-soft">
                오늘은 어떤 주제의 블로그 글을 작성하시겠습니까?
              </p>
            </div>

            {/* AI Topic Recommendations */}
            <div className="bg-surface rounded-card shadow-card p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">AI 주제 추천</h3>
                <button
                  onClick={fetchTopicRecommendations}
                  disabled={loadingTopics}
                  className={`${btnPrimary} px-4 py-2`}
                >
                  {loadingTopics ? '추천 중...' : '주제 추천 받기'}
                </button>
              </div>

              {topics && (
                <div className="grid md:grid-cols-2 gap-6">
                  {pack.topicCategories.map((category, categoryIndex) => (
                    <div key={category.key}>
                      <h4 className="text-xs font-semibold tracking-wider uppercase text-ink-faint mb-3">
                        {category.key} 주제
                      </h4>
                      <div className="space-y-2">
                        {(topics[category.key] ?? []).map((topic, idx) => (
                          <button
                            key={idx}
                            onClick={() => generateBlog(topic)}
                            className={`w-full text-left px-4 py-3 rounded-xl transition-colors text-ink ${
                              categoryIndex % 2 === 0
                                ? 'bg-paper hover:bg-accent-tint border border-line'
                                : 'bg-accent-tint hover:bg-line'
                            }`}
                          >
                            {topic}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Topic Input */}
            <div className="bg-surface rounded-card shadow-card p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">
                <label htmlFor="custom-topic">직접 주제 입력</label>
              </h3>
              <div className="flex gap-3">
                <input
                  id="custom-topic"
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="원하는 주제를 입력하세요"
                  className="flex-1 px-4 py-3 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent"
                  onKeyDown={(e) => e.key === 'Enter' && customTopic && generateBlog(customTopic)}
                />
                <button
                  onClick={() => customTopic && generateBlog(customTopic)}
                  disabled={!customTopic || generatingBlog}
                  className={`${btnPrimary} px-6 py-3`}
                >
                  생성
                </button>
              </div>
            </div>

            {/* Saved Posts */}
            {savedPosts.length > 0 && (
              <div className="bg-surface rounded-card shadow-card p-6">
                <h3 className="text-lg font-semibold mb-4">저장된 글 (최근 10개)</h3>
                <div className="space-y-2">
                  {savedPosts.map((post) => (
                    <button
                      key={post.id}
                      onClick={() => loadSavedPost(post)}
                      className="w-full text-left px-4 py-3 border border-line hover:border-accent hover:bg-accent-tint rounded-lg transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-ink">{post.title}</h4>
                          <p className="text-sm text-ink-faint mt-1">{post.topic}</p>
                        </div>
                        <span className="text-xs text-ink-faint ml-4">
                          {new Date(post.created_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {generatingBlog && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-surface rounded-lg p-8 max-w-sm">
                  <div className="flex flex-col items-center">
                    <svg className="animate-spin h-12 w-12 text-accent mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-ink font-medium">블로그 글을 생성하고 있습니다...</p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Blog Result */
          <div className="space-y-6 lg:space-y-0 lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:gap-4">
            {/* Toolbar is pinned above both columns so it stays reachable
                no matter how far either one is scrolled. */}
            <div className="flex flex-wrap gap-3">
              {currentPostId && (
                <>
                  <button
                    onClick={toggleEditMode}
                    className={`${btnSecondary} flex-1 min-w-[150px] py-3 px-6`}
                  >
                    {isEditMode ? '취소' : '수정'}
                  </button>
                  {isEditMode && (
                    <button
                      onClick={handleSaveEdit}
                      className={`${btnPrimary} flex-1 min-w-[150px] py-3 px-6`}
                    >
                      저장
                    </button>
                  )}
                </>
              )}
              <button
                onClick={handleCopyAll}
                className={`${isEditMode ? btnSecondary : btnPrimary} flex-1 min-w-[150px] py-3 px-6`}
              >
                {copied ? '복사됨 ✓' : '전체 복사'}
              </button>
              <button
                onClick={() => {
                  // Use history.back() to return to previous state
                  window.history.back();
                }}
                className={`${btnSecondary} flex-1 min-w-[150px] py-3 px-6`}
              >
                새 글 작성
              </button>
            </div>

            {/* Article left, images right, each scrolling on its own so the
                two can be read against each other. Below lg they stack and
                the page scrolls as one. */}
            <div
              className={`space-y-6 lg:space-y-0 lg:grid lg:gap-14 lg:flex-1 lg:min-h-0 ${
                imagePrompts.length > 0
                  ? 'lg:grid-cols-2'
                  : 'lg:grid-cols-1'
              }`}
            >
              <div className="lg:min-h-0 lg:overflow-y-auto lg:pr-1">
              <div className="bg-surface rounded-card shadow-card p-8">
                {isEditMode ? (
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full min-h-[600px] p-4 border border-line-strong rounded-lg focus:ring-2 focus:ring-accent font-mono text-sm"
                    placeholder="글 내용을 편집하세요..."
                  />
                ) : (
                  // Serif at a constrained measure: this is the one place the
                  // tenant reads the article as a reader would, so awkward
                  // sentences and typos have to surface here.
                  // Centred rather than left-aligned: the reading measure is
                  // narrower than the column, so centring keeps the leftover
                  // space symmetric instead of pooling it all on the right.
                  <div className="markdown-content font-serif max-w-[62ch] mx-auto break-keep">
                    <ArticleBody content={blogResult.content} />
                  </div>
                )}
              </div>
              </div>

              <div className="lg:min-h-0 lg:overflow-y-auto lg:pr-1">
              {/* Image Prompts Section */}
              {imagePrompts.length > 0 && (
                <div className="bg-accent-tint border border-line rounded-card p-6">
                  <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                    <h3 className="font-semibold text-accent-strong">이미지 프롬프트 ({imagePrompts.length}/5)</h3>
                    {/* flex-wrap: two selects plus two buttons overflow narrow
                        viewports without it. */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Image model selector */}
                      <select
                        aria-label="이미지 생성 모델"
                        value={imageProvider}
                        onChange={(e) => setImageProvider(e.target.value)}
                        className="px-3 py-2 border border-line-strong rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="openai">GPT-Image-2 (OpenAI)</option>
                        <option value="gemini">Gemini 3 Pro Image (Google)</option>
                      </select>
                      {/* Quality selector — OpenAI only */}
                      {imageProvider === 'openai' && (
                        <select
                          aria-label="이미지 품질"
                          value={imageQuality}
                          onChange={(e) => setImageQuality(e.target.value as 'low' | 'medium' | 'high')}
                          className="px-3 py-2 border border-line-strong rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                          <option value="low">Low (~30초)</option>
                          <option value="medium">Medium (~80초)</option>
                          <option value="high">High (~250초)</option>
                        </select>
                      )}
                      <button
                        onClick={handleGenerateImages}
                        disabled={generatingImages}
                        className={`${btnPrimary} px-4 py-2 text-sm`}
                      >
                        {generatingImages ? '생성 중...' : '전체 생성'}
                      </button>
                      <button
                        onClick={() => setEditingPrompts(!editingPrompts)}
                        className={`${btnSecondary} px-4 py-2 text-sm`}
                      >
                        {editingPrompts ? '완료' : '편집'}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {imagePrompts.map((prompt, index) => {
                      const image = generatedImages[index];
                      const isRegenerating = regeneratingIndices.has(index);

                      return (
                        <div key={index} className="bg-surface rounded-card p-4 border border-line flex flex-col">
                          {/* Top: Prompt info */}
                          <div className="flex items-start gap-3 mb-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-accent text-white rounded-full flex items-center justify-center font-semibold">
                              {index + 1}
                            </div>
                            <div className="flex-1 space-y-2 min-w-0">
                              <div>
                                {editingPrompts ? (
                                  <label htmlFor={`prompt-${index}-type`} className="text-xs font-semibold text-ink-soft uppercase">Type</label>
                                ) : (
                                  <span className="block text-xs font-semibold text-ink-soft uppercase">Type</span>
                                )}
                                {editingPrompts ? (
                                  <select
                                    id={`prompt-${index}-type`}
                                    value={prompt.type}
                                    onChange={(e) => {
                                      const newPrompts = [...imagePrompts];
                                      newPrompts[index].type = e.target.value;
                                      setImagePrompts(newPrompts);
                                    }}
                                    className="w-full mt-1 px-3 py-2 border border-line-strong rounded-lg text-sm"
                                  >
                                    {IMAGE_TYPES.map((imageType) => (
                                      <option key={imageType} value={imageType}>
                                        {imageType} · {pack.images.slots[imageType].label}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="mt-1 px-3 py-2 bg-accent-tint text-accent-strong rounded-lg text-sm font-semibold inline-block">
                                    {prompt.type}
                                  </div>
                                )}
                              </div>
                              <div>
                                {editingPrompts ? (
                                  <label htmlFor={`prompt-${index}-description`} className="text-xs font-semibold text-ink-soft uppercase">이미지 묘사</label>
                                ) : (
                                  <span className="block text-xs font-semibold text-ink-soft uppercase">이미지 묘사</span>
                                )}
                                {editingPrompts ? (
                                  <textarea
                                    id={`prompt-${index}-description`}
                                    value={prompt.description}
                                    onChange={(e) => {
                                      const newPrompts = [...imagePrompts];
                                      newPrompts[index].description = e.target.value;
                                      setImagePrompts(newPrompts);
                                    }}
                                    className="w-full mt-1 px-3 py-2 border border-line-strong rounded-lg text-sm"
                                    rows={2}
                                  />
                                ) : (
                                  <p className="mt-1 text-ink text-sm break-words">{prompt.description}</p>
                                )}
                              </div>
                              {pack.images.slots[resolveImageType(prompt.type)].hasTextOverlay && (
                                <div>
                                  {editingPrompts ? (
                                    <label htmlFor={`prompt-${index}-text`} className="text-xs font-semibold text-ink-soft uppercase">텍스트</label>
                                  ) : (
                                    <span className="block text-xs font-semibold text-ink-soft uppercase">텍스트</span>
                                  )}
                                  {editingPrompts ? (
                                    <input
                                      id={`prompt-${index}-text`}
                                      type="text"
                                      value={prompt.text}
                                      onChange={(e) => {
                                        const newPrompts = [...imagePrompts];
                                        newPrompts[index].text = e.target.value;
                                        setImagePrompts(newPrompts);
                                      }}
                                      className="w-full mt-1 px-3 py-2 border border-line-strong rounded-lg text-sm"
                                    />
                                  ) : (
                                    <p className="mt-1 text-accent font-medium text-sm break-words">{prompt.text || '(없음)'}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Bottom: Image preview and buttons */}
                          <div className="space-y-2 mt-auto">
                            {image ? (
                              <div className="relative w-full aspect-square bg-accent-tint rounded-lg overflow-hidden">
                                {isRegenerating && (
                                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
                                    <div className="bg-surface rounded-lg p-3">
                                      <svg className="animate-spin h-6 w-6 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                    </div>
                                  </div>
                                )}
                                <Image
                                  src={image.url}
                                  alt={image.keyword}
                                  fill
                                  className="object-contain"
                                  unoptimized
                                />
                              </div>
                            ) : (
                              <div className="w-full aspect-square bg-accent-tint rounded-lg flex items-center justify-center border-2 border-dashed border-line-strong">
                                <p className="text-ink-faint text-sm text-center px-2">이미지 없음</p>
                              </div>
                            )}
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => handleRegenerateImage(index)}
                                disabled={isRegenerating}
                                className={`${btnSecondary} w-full px-3 py-2 text-sm`}
                              >
                                {isRegenerating ? '생성 중...' : image ? '다시 생성' : '이미지 생성'}
                              </button>
                              {image ? (
                                <a
                                  href={image.url}
                                  download={`${image.keyword}.png`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`${btnSecondary} w-full text-center px-3 py-2 text-sm`}
                                >
                                  다운로드
                                </a>
                              ) : (
                                <button
                                  disabled
                                  className={`${btnSecondary} w-full px-3 py-2 text-sm`}
                                >
                                  다운로드
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        )}
      </main>

      <ConfirmDialog
        open={pendingRegenIndex !== null}
        title="이미지를 다시 생성할까요?"
        message="기존 이미지는 삭제되고 새 이미지로 교체됩니다."
        confirmLabel="다시 생성"
        onConfirm={() => {
          const index = pendingRegenIndex;
          setPendingRegenIndex(null);
          if (index !== null) void regenerateImage(index);
        }}
        onCancel={() => setPendingRegenIndex(null)}
      />
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
