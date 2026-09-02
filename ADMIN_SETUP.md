# 관리자 인증 시스템 설정 가이드

## 📋 개요

관리자 페이지 접근을 보호하기 위한 DB 기반 인증 시스템이 구현되었습니다.

## 🔧 설정 단계

### 1. 데이터베이스 마이그레이션 실행

Supabase Dashboard → SQL Editor에서 다음 파일을 실행:

```
supabase-migrations/create-admins-table.sql
```

이 마이그레이션은 `admins` 테이블만 생성합니다. **기본 관리자 계정은 더 이상 자동으로 생성되지 않습니다** — 하드코딩된 비밀번호를 소스코드에 커밋하는 것 자체가 보안 위험이기 때문입니다.

### 2. 첫 관리자 계정 생성

```bash
node scripts/generate-admin-hash.js <username> '<your-own-strong-password>'
```

이 스크립트가 출력하는 `INSERT INTO admins (...)` 문을 Supabase SQL Editor에서 그대로 실행하세요.

이전에 이 프로젝트를 이미 배포해서 기본 계정(`admin` / `admin123!`)이 만들어져 있다면, 위 방법으로 새 관리자를 먼저 만든 뒤 `supabase-migrations/rotate-default-admin.sql`을 실행해 기존 기본 계정을 비활성화하세요.

### 3. 비밀번호 변경 방법

```bash
node scripts/generate-admin-hash.js <username> '<new-password>'
```

출력되는 `UPDATE admins SET password_hash = ...` 문을 Supabase SQL Editor에서 실행하세요.

## 🔒 보안 기능

### 구현된 보안 요소

1. **세션 기반 인증**
   - 24시간 유효 세션
   - HttpOnly 쿠키로 XSS 방어
   - 일반 계정 세션과 완전히 분리 (`type: 'admin'`)

2. **API 보호**
   - 모든 `/api/admin/*` 엔드포인트에 세션 검증
   - 401 Unauthorized 응답으로 미인증 차단

3. **페이지 보호**
   - `/admin` 페이지 접근 시 자동 인증 체크
   - 미인증 시 `/admin/login`으로 리다이렉트

4. **비밀번호 보안**
   - bcrypt 해싱 (rounds=10)
   - 데이터베이스에 평문 저장 안 함

### 향후 개선 가능 항목

1. **비밀번호 변경 UI**
   - `/admin/change-password` 페이지 추가
   - 관리자가 직접 변경 가능

2. **다중 관리자**
   - 새 관리자 계정 생성 UI
   - 역할 기반 권한 (super_admin, admin, viewer)

3. **감사 로그**
   - 관리자 활동 기록
   - 계정 계정 생성/수정 이력 추적

4. **2FA (Two-Factor Authentication)**
   - TOTP 기반 2단계 인증

## 📊 데이터베이스 스키마

### `admins` 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | Primary Key |
| username | TEXT | 로그인 ID (고유) |
| password_hash | TEXT | bcrypt 해시 |
| role | TEXT | 역할 (super_admin, admin, viewer) |
| full_name | TEXT | 관리자 이름 |
| email | TEXT | 이메일 |
| is_active | BOOLEAN | 활성화 여부 |
| last_login_at | TIMESTAMPTZ | 마지막 로그인 시간 |
| created_at | TIMESTAMPTZ | 생성 시간 |
| updated_at | TIMESTAMPTZ | 수정 시간 |

## 🚦 사용 흐름

### 관리자 로그인
```
/admin/login → 인증 확인 → /admin (대시보드)
```

### 미인증 접근 차단
```
/admin → 세션 없음 → /admin/login (리다이렉트)
```

### API 호출
```
fetch('/api/admin/tenants')
  → admin_session 쿠키 체크
  → 유효하면 데이터 반환
  → 무효하면 401 Unauthorized
```

## ⚠️ 중요 보안 노트

1. **기존 배포 확인**: 예전 버전을 배포한 적이 있다면 기본 계정(`admin` / `admin123!`)이 아직 활성 상태인지 확인하고 `rotate-default-admin.sql`로 비활성화하세요
2. **프로덕션 환경**: 강력한 비밀번호 정책 적용
3. **HTTPS 필수**: 프로덕션에서는 반드시 HTTPS 사용
4. **세션 쿠키 보안**: `secure` 플래그는 프로덕션에서 자동 활성화됨

## 📝 추가 관리자 계정 생성

```bash
node scripts/generate-admin-hash.js new_admin '<strong-password>'
```

출력되는 `INSERT INTO admins (...)` 문을 Supabase SQL Editor에서 실행하세요.

## 🔍 문제 해결

### 로그인이 안 될 때
1. 브라우저 쿠키 확인 (admin_session)
2. 데이터베이스에서 관리자 계정 확인:
   ```sql
   SELECT * FROM admins WHERE username = 'admin';
   ```
3. 비밀번호 해시 재생성 및 업데이트

### API 401 오류
1. 브라우저 개발자 도구 → Application → Cookies 확인
2. admin_session 쿠키가 있고 유효한지 확인
3. 만료 시간(exp) 체크

## 🎯 다음 단계

1. ✅ 마이그레이션 실행
2. ✅ 첫 로그인 테스트
3. ⚠️ 기본 비밀번호 변경
4. 📌 필요시 추가 관리자 계정 생성
5. 🔐 프로덕션 배포 시 보안 체크리스트 확인
