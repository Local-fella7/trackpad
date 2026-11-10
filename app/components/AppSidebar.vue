<script setup lang="ts">
import { LayoutDashboard, FileText, WalletCards, BarChart3, LogOut, Plus } from 'lucide-vue-next'

export type Page = 'dashboard' | 'orders' | 'billing' | 'reports'

defineProps<{
  page: Page
  user: { displayName: string; username: string } | null
  unpaidCount?: number
  deliveryCount?: number
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
      <span class="logo-mark">TP</span>
      <div class="brand-text">
        <span>WORKSPACE</span>
        <strong>TRACKPAD</strong>
      </div>
    </div>

    <!-- New Order CTA -->
    <button class="new-btn" type="button" @click="emit('new-record')">
      <Plus :size="17" />
      <span>New Order</span>
    </button>

    <!-- Navigation -->
    <div class="nav-label">MAIN MENU</div>
    <nav>
      <button type="button" :class="{ active: page === 'dashboard' }" @click="emit('navigate', 'dashboard')">
        <LayoutDashboard :size="18" />
        <span>Overview</span>
      </button>
      <button type="button" :class="{ active: page === 'orders' }" @click="emit('navigate', 'orders')">
        <FileText :size="18" />
        <span>Orders</span>
        <em v-if="deliveryCount" class="nav-badge tan" :title="`${deliveryCount} due for delivery`">{{ deliveryCount }}</em>
      </button>
      <button type="button" :class="{ active: page === 'billing' }" @click="emit('navigate', 'billing')">
        <WalletCards :size="18" />
        <span>Billing</span>
        <em v-if="unpaidCount" class="nav-badge rust" :title="`${unpaidCount} unpaid orders`">{{ unpaidCount }}</em>
      </button>
      <button type="button" :class="{ active: page === 'reports' }" @click="emit('navigate', 'reports')">
        <BarChart3 :size="18" />
        <span>Reports</span>
      </button>
    </nav>

    <!-- User footer -->
    <div class="user-footer">
      <div class="user-info">
        <span class="avatar">{{ user?.displayName?.slice(0, 1).toUpperCase() || 'U' }}</span>
        <div class="user-text">
          <strong>{{ user?.displayName }}</strong>
          <small>@{{ user?.username }}</small>
        </div>
      </div>
      <button class="logout-btn" type="button" title="Sign out" aria-label="Sign out" @click="emit('logout')">
        <LogOut :size="16" />
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 248px;
  height: 100vh;
  position: sticky;
  top: 0;
  background: #43766C;
  color: #F8FAE5;
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
  gap: 6px;
  flex-shrink: 0;
  border-right: 1px solid rgba(248, 250, 229, 0.12);
  box-shadow: 4px 0 24px rgba(38, 33, 29, 0.08);
}

/* Brand */
.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 2px 6px;
  margin-bottom: 18px;
}

.logo-mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  background: #B19470;
  color: #F8FAE5;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.04em;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(38, 33, 29, 0.18);
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  color: rgba(248, 250, 229, 0.68);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.brand-text strong {
  color: #F8FAE5;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.03em;
}

/* New Order Button */
.new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #F8FAE5;
  border: 1px solid #F8FAE5;
  color: #43766C;
  border-radius: 10px;
  padding: 11px 14px;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  margin-bottom: 18px;
  box-shadow: 0 6px 16px rgba(24, 38, 34, 0.16);
  transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.new-btn:hover {
  background: #ffffff;
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(24, 38, 34, 0.22);
}

.nav-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: rgba(248, 250, 229, 0.55);
  padding: 0 10px 4px;
}

/* Navigation */
nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

nav button {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  border: 0;
  background: transparent;
  color: rgba(248, 250, 229, 0.75);
  text-align: left;
  padding: 11px 13px;
  border-radius: 10px;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

nav button:hover {
  background: rgba(248, 250, 229, 0.1);
  color: #F8FAE5;
}

nav button.active {
  background: rgba(248, 250, 229, 0.18);
  color: #F8FAE5;
  font-weight: 800;
  box-shadow: inset 3px 0 0 #B19470;
}

.nav-badge {
  margin-left: auto;
  font-style: normal;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 99px;
  line-height: 1.3;
}

.nav-badge.tan {
  background: #B19470;
  color: #F8FAE5;
}

.nav-badge.rust {
  background: #76453B;
  color: #F8FAE5;
}

/* User Footer */
.user-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding: 14px 8px 4px;
  border-top: 1px solid rgba(248, 250, 229, 0.16);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.avatar {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #B19470;
  color: #F8FAE5;
  font-size: 13px;
  font-weight: 800;
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
  color: #F8FAE5;
  font-size: 12.5px;
  font-weight: 700;
}

.user-text small {
  color: rgba(248, 250, 229, 0.65);
  font-size: 11px;
}

.logout-btn {
  border: 0;
  background: rgba(248, 250, 229, 0.08);
  color: rgba(248, 250, 229, 0.78);
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;
}

.logout-btn:hover {
  color: #F8FAE5;
  background: #76453B;
}

/* Responsive */
@media (max-width: 900px) {
  .sidebar { width: 68px; padding: 20px 10px; }
  .brand-text,
  .nav-label,
  nav button span,
  .nav-badge,
  .new-btn span,
  .user-text { display: none; }
  .new-btn { padding: 10px; justify-content: center; }
  .brand { justify-content: center; padding: 0; }
  nav button { justify-content: center; padding: 11px; }
  .user-footer { flex-direction: column; gap: 8px; justify-content: center; padding-inline: 0; }
  .user-info { flex: none; }
}
</style>
