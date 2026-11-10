<script setup lang="ts">
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-vue-next'
import StatusProgress from './StatusProgress.vue'

const props = defineProps<{
  dashboard: any
  money: (v: number) => string
  date: (v?: string) => string
}>()

const emit = defineEmits<{
  filter: [value: string]
  refresh: []
}>()

const max = (rows: any[], key: string) => Math.max(...(rows || []).map(row => Number(row[key]) || 0), 1)

const calendarDays = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    return {
      key,
      label: d.toLocaleDateString('en-TZ', { weekday: 'short' }),
      day: d.getDate(),
      data: props.dashboard?.calendar?.find((x: any) => x.event_date === key),
    }
  }),
)

const statusList = computed(() => {
  const palette: Record<string, string> = {
    Confirmed: '#43766C',
    Pending: '#B19470',
    Cancelled: '#76453B',
  }
  return ['Confirmed', 'Pending', 'Cancelled'].map(name => {
    const match = props.dashboard?.byStatus?.find((x: any) => x.name === name)
    return {
      name,
      color: palette[name] || '#B19470',
      count: Number(match?.count || 0),
    }
  })
})

const activityBars = computed(() => {
  const rows: any[] = props.dashboard?.last30Days || []
  const highest = max(rows, 'count')
  return rows.slice(-14).map(row => ({
    date: row.record_date,
    label: row.record_date?.slice(5) || '',
    count: Number(row.count || 0),
    height: `${Math.max(12, Math.round((Number(row.count || 0) / highest) * 100))}%`,
  }))
})
</script>

<template>
  <div class="dashboard-shell">
    <!-- Attention Banner -->
    <section v-if="dashboard?.unpaidCount > 0 || dashboard?.deliveryCount > 0" class="attention-banner">
      <div class="attention-title">
        <span class="pulse-dot"></span>
        <strong>Action Required</strong>
        <span>Items that need your follow-up today</span>
      </div>
      <div class="attention-chips">
        <button v-if="dashboard?.unpaidCount > 0" type="button" class="chip rust" @click="emit('filter', 'unpaid')">
          <AlertCircle :size="15" />
          <span><b>{{ dashboard.unpaidCount }}</b> unpaid order{{ dashboard.unpaidCount === 1 ? '' : 's' }}</span>
          <ArrowUpRight :size="14" />
        </button>
        <button v-if="dashboard?.deliveryCount > 0" type="button" class="chip tan" @click="emit('filter', 'delivery')">
          <Clock :size="15" />
          <span><b>{{ dashboard.deliveryCount }}</b> due for delivery</span>
          <ArrowUpRight :size="14" />
        </button>
      </div>
    </section>

    <!-- 6 KPI Cards -->
    <section class="metrics">
      <article class="kpi-card highlight-teal">
        <div class="kpi-top">
          <span>MONTHLY VALUE</span>
          <i class="kpi-icon teal"><TrendingUp :size="18" /></i>
        </div>
        <strong>{{ money(dashboard?.monthSummary?.[0]?.total || 0) }}</strong>
        <small :class="{ up: dashboard?.valueTrend >= 0, down: dashboard?.valueTrend < 0 }">
          {{
            dashboard?.valueTrend === null || dashboard?.valueTrend === undefined
              ? 'Current month order value'
              : `${dashboard.valueTrend >= 0 ? '↑' : '↓'} ${Math.abs(dashboard.valueTrend)}% vs last month`
          }}
        </small>
      </article>

      <article class="kpi-card">
        <div class="kpi-top">
          <span>PAID TOTAL</span>
          <i class="kpi-icon teal"><CheckCircle2 :size="18" /></i>
        </div>
        <strong>{{ money(dashboard?.paidTotal || 0) }}</strong>
        <small>Total payments collected</small>
      </article>

      <article class="kpi-card highlight-rust" @click="emit('filter', 'unpaid')">
        <div class="kpi-top">
          <span>OUTSTANDING BALANCE</span>
          <i class="kpi-icon rust"><Wallet :size="18" /></i>
        </div>
        <strong class="rust-text">{{ money(dashboard?.outstandingTotal || 0) }}</strong>
        <small>{{ dashboard?.unpaidCount || 0 }} order{{ dashboard?.unpaidCount === 1 ? '' : 's' }} awaiting payment</small>
      </article>

      <article class="kpi-card">
        <div class="kpi-top">
          <span>ORDERS TODAY</span>
          <i class="kpi-icon tan"><Sparkles :size="18" /></i>
        </div>
        <strong>{{ dashboard?.recordsToday || 0 }}</strong>
        <small>Created today</small>
      </article>

      <article class="kpi-card" @click="emit('filter', '')">
        <div class="kpi-top">
          <span>ACTIVE ORDERS</span>
          <i class="kpi-icon teal"><Layers :size="18" /></i>
        </div>
        <strong>{{ dashboard?.activeRecords || 0 }}</strong>
        <small>Total orders in register</small>
      </article>

      <article class="kpi-card">
        <div class="kpi-top">
          <span>UPCOMING EVENTS</span>
          <i class="kpi-icon tan"><CalendarClock :size="18" /></i>
        </div>
        <strong>{{ dashboard?.upcomingEvents?.length || 0 }}</strong>
        <small>Scheduled in next 30 days</small>
      </article>
    </section>

    <!-- Main Dashboard Grid -->
    <section class="grid">
      <!-- 7-Day Event Schedule & Activity -->
      <article class="card">
        <div class="heading">
          <div>
            <span class="eyebrow">Schedule</span>
            <h2>Next 7 Days</h2>
          </div>
          <CalendarDays :size="18" class="muted-icon" />
        </div>
        <div class="calendar">
          <div
            v-for="d in calendarDays"
            :key="d.key"
            :class="{ today: d.key === new Date().toISOString().slice(0, 10), busy: Boolean(d.data) }"
          >
            <small>{{ d.label }}</small>
            <b>{{ d.day }}</b>
            <em v-if="d.data" :title="`${d.data.count} event(s)`">{{ d.data.count }}</em>
            <span v-else class="dot-empty">·</span>
          </div>
        </div>

        <div class="sub-section">
          <div class="sub-heading">
            <span>Recent Daily Order Volume</span>
            <small>{{ activityBars.length }} active days</small>
          </div>
          <div v-if="activityBars.length" class="activity-bars">
            <div v-for="bar in activityBars" :key="bar.date" class="bar-col" :title="`${bar.date}: ${bar.count} orders`">
              <div class="bar-track">
                <i :style="{ height: bar.height }"></i>
              </div>
              <small>{{ bar.label }}</small>
            </div>
          </div>
          <p v-else class="empty-compact">Order activity bars will appear as orders are recorded.</p>
        </div>
      </article>

      <!-- Order Status Breakdown -->
      <article class="card">
        <div class="heading">
          <div>
            <span class="eyebrow">Workflow</span>
            <h2>Order Status Breakdown</h2>
          </div>
          <BarChart3 :size="18" class="muted-icon" />
        </div>
        <div class="status-list">
          <StatusProgress
            v-for="s in statusList"
            :key="s.name"
            :name="s.name"
            :color="s.color"
            :count="s.count"
            :total="dashboard?.activeRecords || 0"
          />
        </div>
        <div class="status-summary-box">
          <div>
            <small>Confirmed Rate</small>
            <strong>
              {{
                dashboard?.activeRecords
                  ? Math.round(((statusList.find(s => s.name === 'Confirmed')?.count || 0) / dashboard.activeRecords) * 100)
                  : 0
              }}%
            </strong>
          </div>
          <div>
            <small>Collection Progress</small>
            <strong>
              {{
                dashboard?.paidTotal + dashboard?.outstandingTotal > 0
                  ? Math.round((dashboard.paidTotal / (dashboard.paidTotal + dashboard.outstandingTotal)) * 100)
                  : 0
              }}%
            </strong>
          </div>
        </div>
      </article>

      <!-- Upcoming Events List -->
      <article class="card full">
        <div class="heading">
          <div>
            <span class="eyebrow">Operations</span>
            <h2>Upcoming Events</h2>
            <small>Events scheduled over the next 30 days</small>
          </div>
          <button type="button" class="link-btn" @click="emit('filter', '')">
            View all orders <ArrowUpRight :size="15" />
          </button>
        </div>

        <div v-if="dashboard?.upcomingEvents?.length" class="event-list">
          <button
            v-for="event in dashboard.upcomingEvents.slice(0, 5)"
            :key="event.id"
            type="button"
            class="event-row"
            @click="emit('filter', '')"
          >
            <div class="event-date-badge">
              <b>{{ date(event.event_date) }}</b>
              <small><MapPin :size="12" /> {{ event.location || 'Location not set' }}</small>
            </div>
            <div class="event-client">
              <b>{{ event.client_name }}</b>
              <span class="status-pill">{{ event.status_name }}</span>
            </div>
            <strong class="event-amount">{{ money(event.grand_total_minor) }}</strong>
          </button>
        </div>
        <p v-else class="empty">No upcoming events scheduled in the next 30 days.</p>
      </article>

      <!-- Outstanding Clients -->
      <article class="card">
        <div class="heading">
          <div>
            <span class="eyebrow">Receivables</span>
            <h2>Outstanding Clients</h2>
          </div>
          <button v-if="dashboard?.outstandingClients?.length" type="button" class="link-btn" @click="emit('filter', 'unpaid')">
            Review <ArrowUpRight :size="14" />
          </button>
        </div>
        <div v-if="dashboard?.outstandingClients?.length" class="client-list">
          <button
            v-for="client in dashboard.outstandingClients.slice(0, 5)"
            :key="client.client_name"
            type="button"
            class="action-row"
            @click="emit('filter', 'unpaid')"
          >
            <span class="client-avatar rust">{{ client.client_name?.slice(0, 1).toUpperCase() }}</span>
            <span class="client-meta">
              <b>{{ client.client_name }}</b>
              <small>{{ client.orders }} unpaid order{{ client.orders === 1 ? '' : 's' }}</small>
            </span>
            <strong class="rust-text">{{ money(client.balance_minor) }}</strong>
          </button>
        </div>
        <p v-else class="empty">All client balances are settled.</p>
      </article>

      <!-- Top Clients -->
      <article class="card">
        <div class="heading">
          <div>
            <span class="eyebrow">Relationships</span>
            <h2>Top Clients by Value</h2>
          </div>
          <Users :size="18" class="muted-icon" />
        </div>
        <div v-if="dashboard?.topClients?.length" class="rank-list">
          <div v-for="(client, idx) in dashboard.topClients" :key="client.client_name" class="rank">
            <div class="rank-top">
              <span class="rank-name"><b>#{{ idx + 1 }}</b> {{ client.client_name }}</span>
              <strong>{{ money(client.total) }}</strong>
            </div>
            <i class="rank-bar">
              <em :style="{ width: `${(Number(client.total) / max(dashboard.topClients, 'total')) * 100}%` }"></em>
            </i>
          </div>
        </div>
        <p v-else class="empty">Client rankings will appear once orders are saved.</p>
      </article>
    </section>

    <small class="fresh">
      Last updated {{ dashboard?.generatedAt ? new Date(dashboard.generatedAt).toLocaleTimeString() : 'just now' }}
    </small>
  </div>
</template>

<style scoped>
.dashboard-shell {
  display: grid;
  gap: 18px;
}

/* Attention Banner */
.attention-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 20px;
  background: #FFFFFF;
  border: 1px solid #E5DEC9;
  border-left: 4px solid #76453B;
  border-radius: 14px;
  box-shadow: 0 6px 20px rgba(38, 33, 29, 0.04);
}

.attention-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.attention-title strong {
  color: #76453B;
  font-weight: 800;
}

.attention-title span {
  color: var(--muted);
}

.pulse-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #76453B;
  box-shadow: 0 0 0 4px rgba(118, 69, 59, 0.16);
}

.attention-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  border-radius: 99px;
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.chip:hover {
  transform: translateY(-1px);
}

.chip.rust {
  background: #F6ECEA;
  color: #76453B;
  border-color: rgba(118, 69, 59, 0.22);
}

.chip.tan {
  background: #F4EFE8;
  color: #76453B;
  border-color: rgba(177, 148, 112, 0.35);
}

/* KPI Metrics Grid */
.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.kpi-card,
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 15px;
  padding: 20px 22px;
  box-shadow: 0 8px 24px rgba(38, 33, 29, 0.04);
}

.kpi-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(38, 33, 29, 0.07);
}

.kpi-card.highlight-teal {
  background: linear-gradient(135deg, #43766C 0%, #355f57 100%);
  border-color: #43766C;
  color: #F8FAE5;
}

.kpi-card.highlight-teal .kpi-top span,
.kpi-card.highlight-teal small {
  color: rgba(248, 250, 229, 0.8) !important;
}

.kpi-card.highlight-teal .kpi-icon.teal {
  background: rgba(248, 250, 229, 0.18);
  color: #F8FAE5;
}

.kpi-card.highlight-rust {
  cursor: pointer;
}

.kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.kpi-top span {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--muted);
}

.kpi-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.kpi-icon.teal {
  background: #E9F1EF;
  color: #43766C;
}

.kpi-icon.tan {
  background: #F4EFE8;
  color: #B19470;
}

.kpi-icon.rust {
  background: #F6ECEA;
  color: #76453B;
}

.kpi-card strong {
  display: block;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin: 10px 0 6px;
}

.rust-text {
  color: #76453B;
}

.kpi-card small {
  display: block;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}

.up {
  color: #43766C !important;
  font-weight: 700;
}

.down {
  color: #76453B !important;
  font-weight: 700;
}

/* Main Grid */
.grid {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 16px;
}

.full {
  grid-column: span 2;
}

.eyebrow {
  display: block;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #B19470;
  margin-bottom: 3px;
}

.heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
}

.heading h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: var(--text);
}

.heading small {
  color: var(--muted);
  font-size: 12px;
}

.muted-icon {
  color: #B19470;
}

.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 0;
  background: #F8FAE5;
  color: #43766C;
  padding: 6px 11px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.link-btn:hover {
  background: #E9F1EF;
}

/* Calendar 7 Days */
.calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.calendar > div {
  text-align: center;
  padding: 12px 4px;
  border-radius: 11px;
  background: #F8FAE5;
  border: 1px solid #E5DEC9;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.calendar > div.busy {
  border-color: #B19470;
}

.calendar .today {
  background: #43766C;
  border-color: #43766C;
  color: #F8FAE5;
}

.calendar .today small {
  color: rgba(248, 250, 229, 0.8);
}

.calendar b {
  font-size: 16px;
  font-weight: 800;
}

.calendar em {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #B19470;
  color: #F8FAE5;
  font-size: 10px;
  font-weight: 800;
  font-style: normal;
}

.dot-empty {
  color: #C7B9A5;
  font-size: 12px;
  line-height: 20px;
}

/* Activity Bars */
.sub-section {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.sub-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  margin-bottom: 10px;
}

.activity-bars {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(22px, 1fr));
  gap: 6px;
  height: 92px;
  align-items: end;
  padding: 10px 12px 6px;
  background: #F8FAE5;
  border-radius: 10px;
}

.bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  gap: 4px;
}

.bar-track {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar-track i {
  display: block;
  width: 100%;
  max-width: 14px;
  background: #43766C;
  border-radius: 4px 4px 2px 2px;
}

.bar-col small {
  font-size: 9px;
  color: var(--muted);
}

.empty-compact {
  margin: 0;
  padding: 16px;
  background: #F8FAE5;
  border-radius: 9px;
  text-align: center;
  font-size: 12px;
  color: var(--muted);
}

/* Status Summary Box */
.status-summary-box {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.status-summary-box > div {
  background: #F8FAE5;
  border: 1px solid #E5DEC9;
  border-radius: 10px;
  padding: 12px 14px;
}

.status-summary-box small {
  display: block;
  font-size: 11px;
  color: var(--muted);
  font-weight: 700;
}

.status-summary-box strong {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: #43766C;
  margin-top: 4px;
}

/* Upcoming Events */
.event-list {
  display: grid;
  gap: 8px;
}

.event-row {
  width: 100%;
  display: grid;
  grid-template-columns: 220px 1fr auto;
  align-items: center;
  gap: 14px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: #FBFCF4;
  padding: 12px 16px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.event-row:hover {
  background: #F8FAE5;
  border-color: #B19470;
}

.event-date-badge b {
  display: block;
  font-size: 13px;
  color: #43766C;
}

.event-date-badge small {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: 11.5px;
  margin-top: 2px;
}

.event-client {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-pill {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 99px;
  background: #E9F1EF;
  color: #43766C;
  font-size: 11px;
  font-weight: 800;
}

.event-amount {
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
  white-space: nowrap;
}

/* Outstanding Clients */
.client-list {
  display: grid;
  gap: 6px;
}

.action-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 11px;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: none;
  padding: 10px 4px;
  text-align: left;
  cursor: pointer;
}

.action-row:last-child {
  border-bottom: 0;
}

.client-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}

.client-avatar.rust {
  background: #F6ECEA;
  color: #76453B;
}

.client-meta {
  flex: 1;
  min-width: 0;
}

.client-meta b,
.client-meta small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Top Clients Rank */
.rank-list {
  display: grid;
  gap: 14px;
  margin-top: 8px;
}

.rank {
  display: grid;
  gap: 6px;
  font-size: 12.5px;
}

.rank-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rank-name b {
  color: #B19470;
  margin-right: 4px;
}

.rank-bar {
  display: block;
  height: 8px;
  border-radius: 99px;
  background: #EFECE0;
  overflow: hidden;
}

.rank-bar em {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #43766C, #B19470);
  border-radius: inherit;
}

.empty {
  color: var(--muted);
  text-align: center;
  padding: 28px 12px;
  background: #F8FAE5;
  border-radius: 10px;
  margin: 8px 0 0;
  font-size: 13px;
}

.fresh {
  display: block;
  color: var(--muted);
  text-align: right;
  font-size: 11.5px;
}

@media (max-width: 960px) {
  .metrics {
    grid-template-columns: 1fr 1fr;
  }
  .grid {
    grid-template-columns: 1fr;
  }
  .full {
    grid-column: span 1;
  }
  .event-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}

@media (max-width: 560px) {
  .metrics {
    grid-template-columns: 1fr;
  }
}
</style>
