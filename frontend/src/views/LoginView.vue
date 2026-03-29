<template>
  <div class="login-root">
    <!-- ブランドパネル（左 40%） -->
    <div class="brand-panel">
      <div class="brand-inner">
        <div class="brand-logo">
          <div class="brand-icon">人</div>
          <div class="brand-name">
            <span class="brand-primary">jinij</span>
            <span class="brand-sub">人事システム</span>
          </div>
        </div>

        <p class="brand-tagline">チームを、<br>ちゃんと管理する。</p>

        <ul class="brand-features">
          <li><i class="bi bi-check2"></i> 従業員情報の一元管理</li>
          <li><i class="bi bi-check2"></i> 休暇申請と承認フロー</li>
          <li><i class="bi bi-check2"></i> 部署別ダッシュボード</li>
        </ul>
      </div>
      <!-- 装飾的な背景図形 -->
      <div class="brand-deco" aria-hidden="true"></div>
    </div>

    <!-- フォームパネル（右 60%） -->
    <div class="form-panel">
      <div class="form-inner">
        <div class="form-header">
          <h1>おかえりなさい</h1>
          <p>メールアドレスとパスワードでログインしてください。</p>
        </div>

        <form @submit.prevent="handleLogin" novalidate>
          <div class="field-group">
            <label for="email" class="form-label">
              メールアドレス<span class="req">*</span>
            </label>
            <input
              id="email"
              v-model.trim="form.email"
              type="email"
              class="form-control"
              :class="{ 'is-invalid': errors.email }"
              placeholder="you@company.co.jp"
              autocomplete="email"
              :disabled="loading"
            />
            <div v-if="errors.email" class="invalid-feedback">{{ errors.email }}</div>
          </div>

          <div class="field-group">
            <label for="password" class="form-label">
              パスワード<span class="req">*</span>
            </label>
            <div class="pw-wrap">
              <input
                id="password"
                v-model="form.password"
                :type="showPw ? 'text' : 'password'"
                class="form-control"
                :class="{ 'is-invalid': errors.password }"
                placeholder="••••••••"
                autocomplete="current-password"
                :disabled="loading"
              />
              <button
                type="button"
                class="pw-toggle"
                :aria-label="showPw ? 'パスワードを隠す' : 'パスワードを表示'"
                @click="showPw = !showPw"
                :disabled="loading"
              >
                <i :class="showPw ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
              </button>
            </div>
            <div v-if="errors.password" class="invalid-feedback">{{ errors.password }}</div>
          </div>

          <div v-if="loginError" class="login-error-banner" role="alert">
            <i class="bi bi-exclamation-circle-fill"></i>
            {{ loginError }}
          </div>

          <button
            type="submit"
            class="btn-login"
            :disabled="loading"
          >
            <span v-if="loading">
              <span class="login-spinner"></span>
              ログイン中...
            </span>
            <span v-else>ログイン</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route  = useRoute()
const auth   = useAuthStore()

const form     = reactive({ email: '', password: '' })
const errors   = reactive({ email: '', password: '' })
const loginError = ref('')
const loading    = ref(false)
const showPw     = ref(false)

function validate(): boolean {
  errors.email = ''
  errors.password = ''
  let ok = true

  if (!form.email) {
    errors.email = 'メールアドレスを入力してください'
    ok = false
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'メールアドレスの形式が正しくありません'
    ok = false
  }
  if (!form.password) {
    errors.password = 'パスワードを入力してください'
    ok = false
  } else if (form.password.length < 6) {
    errors.password = '6文字以上で入力してください'
    ok = false
  }
  return ok
}

async function handleLogin() {
  if (!validate()) return
  loading.value = true
  loginError.value = ''

  try {
    await auth.signIn(form.email, form.password)
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (e: unknown) {
    if (e instanceof Error) {
      if (e.message.includes('Invalid login credentials')) {
        loginError.value = 'メールアドレスまたはパスワードが違います。'
      } else if (e.message.includes('Email not confirmed')) {
        loginError.value = 'メールアドレスの確認が完了していません。'
      } else {
        loginError.value = e.message
      }
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-root {
  min-height: 100vh;
  display: flex;
}

/* ---- Brand Panel ---- */
.brand-panel {
  position: relative;
  width: 38%;
  flex-shrink: 0;
  background: var(--brand-900);
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  padding: 3rem;
}

.brand-inner {
  position: relative;
  z-index: 2;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 3rem;
}

.brand-icon {
  width: 42px;
  height: 42px;
  background: var(--accent);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.2rem;
  color: white;
}

.brand-name {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.brand-primary {
  font-size: 1.4rem;
  font-weight: 800;
  color: white;
  letter-spacing: -0.03em;
}

.brand-sub {
  font-size: 0.65rem;
  color: rgba(255,255,255,0.4);
  letter-spacing: 0.05em;
}

.brand-tagline {
  font-size: 1.8rem;
  font-weight: 800;
  color: white;
  line-height: 1.25;
  letter-spacing: -0.02em;
  margin-bottom: 2rem;
}

.brand-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.brand-features li {
  font-size: 0.85rem;
  color: rgba(255,255,255,0.55);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.brand-features .bi {
  color: var(--accent-light);
  font-size: 0.85rem;
  flex-shrink: 0;
}

/* 装飾的な背景 */
.brand-deco {
  position: absolute;
  top: -60px;
  right: -80px;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  pointer-events: none;
}

.brand-deco::after {
  content: '';
  position: absolute;
  top: 60px;
  left: 60px;
  right: 60px;
  bottom: 60px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.04);
}

/* ---- Form Panel ---- */
.form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 3rem 2rem;
}

.form-inner {
  width: 100%;
  max-width: 380px;
}

.form-header {
  margin-bottom: 2.5rem;
}

.form-header h1 {
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--text-primary);
  margin-bottom: 0.4rem;
}

.form-header p {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.field-group {
  margin-bottom: 1.25rem;
}

.req {
  color: var(--danger);
  margin-left: 2px;
}

.pw-wrap {
  position: relative;
}

.pw-wrap .form-control {
  padding-right: 3rem;
}

.pw-toggle {
  position: absolute;
  right: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.25rem;
  font-size: 0.95rem;
  line-height: 1;
  transition: color var(--ease-fast);
}

.pw-toggle:hover { color: var(--text-secondary); }

.login-error-banner {
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger-border);
  border-radius: var(--radius);
  padding: 0.65rem 0.875rem;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.btn-login {
  width: 100%;
  padding: 0.7rem 1.25rem;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius);
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: background var(--ease-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.btn-login:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-login:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.login-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@media (max-width: 768px) {
  .login-root { flex-direction: column; }
  .brand-panel {
    width: 100%;
    padding: 2rem;
    min-height: 180px;
  }
  .brand-tagline { font-size: 1.3rem; }
  .form-panel { padding: 2rem 1.25rem; }
}
</style>
