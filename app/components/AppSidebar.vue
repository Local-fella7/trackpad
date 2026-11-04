<script setup lang="ts">
import { LayoutDashboard, FileText, BarChart3, LogOut } from 'lucide-vue-next'

type Page = 'dashboard' | 'records' | 'reports'

defineProps<{
  page: Page
  user: { displayName: string; username: string } | null
}>()

const emit = defineEmits<{
  navigate: [page: Page]
  logout: []
  'new-record': []
}>()
</script>

<template>
  <aside class="sidebar">
    <!-- Brand -->
    <div class="brand">
      <span class="logo-mark">BR</span>
      <div class="brand-text">
        <span>BUSINESS</span>
        <strong>RECORDS</strong>
      </div>
    </div>

    <!-- New Order CTA -->
    <button class="new-btn" @click="emit('new-record')">
      <span class="plus">+</span>
      <span>New Order</span>
    </button>

    <!-- Navigation -->
    <nav>
      <button :class="{ active: page === 'dashboard' }" @click="emit('navigate', 'dashboard')">
        <LayoutDashboard :size="18" />
        <span>Overview</span>
      </button>
      <button :class="{ active: page === 'records' }" @click="emit('navigate', 'records')">
        <FileText :size="18" />
        <span>Orders</span>
      </button>
      <button :class="{ active: page === 'reports' }" @click="emit('navigate', 'reports')">
        <BarChart3 :size="18" />
        <span>Reports</span>
      </button>
    </nav>

    <!-- User footer -->
    <div class="user-footer">
      <div class="user-info">
        <span class="avatar">{{ user?.displayName.slice(0, 1).toUpperCase() }}</span>
        <div class="user-text">
          <strong>{{ user?.displayName }}</strong>
          <small>{{ user?.username }}</small>
        </div>
      </div>
      <button class="logout-btn" title="Sign out" @click="emit('logout')">
        <LogOut :size="15" />
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 236px;
  min-height: 100vh;
  background: #43766C;
  display: flex;
  flex-direction: column;
  padding: 22px 12px;
  gap: 4px;
  flex-shrink: 0;
}

/* Brand */
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 6px;
  margin-bottom: 18px;
}

.logo-mark {
  display: grid;
  place-items: center;
  width: 37px;
  height: 37px;
  border-radius: 10px;
  background: #B19470;
  color: #fff;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0;
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
  color: rgba(255, 255, 255, 0.65);
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.brand-text strong {
  color: #fff;
  font-size: 14px;
  letter-spacing: 0.02em;
  text-transform: none;
}

/* New Order Button */
.new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: #fff;
  border-radius: 9px;
  padding: 9px 14px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 14px;
  transition: background 0.15s;
}

.new-btn:hover {
  background: rgba(255, 255, 255, 0.24);
}

.plus {
  font-size: 18px;
  line-height: 1;
  font-weight: 300;
}

/* Navigation */
nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

nav button {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.65);
  text-align: left;
  padding: 10px 12px;
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

nav button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

nav button.active {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  font-weight: 700;
}

/* User Footer */
.user-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding: 12px 6px 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 9px;
  flex: 1;
  min-width: 0;
}

.avatar {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #B19470;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.user-text {
  overflow: hidden;
}

.user-text strong,
.user-text small {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-text strong {
  color: #fff;
  font-size: 12px;
}

.user-text small {
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
}

.logout-btn {
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;
}

.logout-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

/* Responsive */
@media (max-width: 900px) {
  .sidebar { width: 62px; }
  .brand-text,
  nav button span,
  .new-btn span,
  .user-text { display: none; }
  .new-btn { padding: 10px; justify-content: center; }
  .brand { justify-content: center; padding: 0; }
  nav button { justify-content: center; padding: 10px; }
  .user-footer { flex-direction: column; gap: 6px; justify-content: center; }
  .user-info { flex: none; }
}
</style>
