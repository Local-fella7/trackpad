<script setup lang="ts">
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  MapPin,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-vue-next'
import { formatDate } from '../../shared/date'
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

const todayIso = () => new Date().toISOString().slice(0, 10)
const calendarCursor = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))

const calendarMonthLabel = computed(() =>
  calendarCursor.value.toLocaleDateString('en-TZ', { month: 'long', year: 'numeric' }),
)

function shiftMonth(delta: number) {
  calendarCursor.value = new Date(calendarCursor.value.getFullYear(), calendarCursor.value.getMonth() + delta, 1)
}

function goToday() {
  calendarCursor.value = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
}

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const monthCells = computed(() => {
  const year = calendarCursor.value.getFullYear()
  const month = calendarCursor.value.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  // Convert Sunday=0..Saturday=6 into Monday=0..Sunday=6
  const startOffset = (firstOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const calendarRows: any[] = props.dashboard?.calendar || []
  const byDate = new Map(calendarRows.map(item => [item.event_date, item]))

  const cells: Array<{
    key: string
    day: number | null
    dateStr?: string
    isToday?: boolean
    confirmedCount: number
    pendingCount: number
    totalCount: number
    clientsList: string[]
  }> = []

  for (let i = 0; i < startOffset; i++) {
    cells.push({ key: `pad-start-${i}`, day: null, confirmedCount: 0, pendingCount: 0, totalCount: 0, clientsList: [] })
  }

  const today = todayIso()
  const pad2 = (n: number) => String(n).padStart(2, '0')
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${pad2(month + 1)}-${pad2(day)}`
    const match = byDate.get(dateStr)
    const confirmedCount = Number(match?.confirmed_count || 0)
    const pendingCount = Number(match?.pending_count || 0)
    const totalCount = Number(match?.count || confirmedCount + pendingCount)
    const clientsList = match?.clients_list
      ? String(match.clients_list)
          .split(' · ')
          .map(s => s.trim())
          .filter(Boolean)
      : []
    cells.push({
      key: dateStr,
      day,
      dateStr,
      isToday: dateStr === today,
      confirmedCount,
      pendingCount,
      totalCount,
      clientsList,
    })
  }

  return cells
})

const statusList = computed(() => {
  const palette: Record<string, string> = {
    Pending: '#B19470',
    Confirmed: '#43766C',
    Completed: '#2d504a',
    Cancelled: '#76453B',
  }
  return ['Pending', 'Confirmed', 'Completed', 'Cancelled'].map(name => {
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
    date: formatDate(row.record_date),
    label: formatDate(row.record_date).slice(0, 5),
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
        <small>Booked on {{ formatDate(todayIso()) }}</small>
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
      <!-- Full-Month Event Schedule Calendar -->
      <article class="card">
        <div class="calendar-header">
          <div>
            <span class="eyebrow">Monthly Event Schedule</span>
            <h2>{{ calendarMonthLabel }}</h2>
          </div>
          <div class="calendar-controls">
            <div class="legend">
              <span class="legend-item"><i class="dot confirmed"></i> Confirmed</span>
              <span class="legend-item"><i class="dot pending"></i> Pending</span>
            </div>
            <div class="month-nav">
              <button type="button" title="Previous month" @click="shiftMonth(-1)"><ChevronLeft :size="15" /></button>
              <button type="button" class="today-btn" @click="goToday">Today</button>
              <button type="button" title="Next month" @click="shiftMonth(1)"><ChevronRight :size="15" /></button>
            </div>
          </div>
        </div>

        <div class="month-weekdays">
          <span v-for="w in weekDays" :key="w">{{ w }}</span>
        </div>

        <div class="month-grid">
          <div
            v-for="cell in monthCells"
            :key="cell.key"
            class="day-cell"
            :class="{
              empty: cell.day === null,
              today: cell.isToday,
              'has-confirmed': cell.confirmedCount > 0 && cell.pendingCount === 0,
              'has-pending': cell.pendingCount > 0 && cell.confirmedCount === 0,
              'has-mixed': cell.confirmedCount > 0 && cell.pendingCount > 0,
            }"
            :title="
              cell.dateStr && cell.totalCount > 0
                ? `${formatDate(cell.dateStr)} · Clients: ${cell.clientsList.join(', ')}`
                : cell.dateStr
                  ? formatDate(cell.dateStr)
                  : ''
            "
            @click="cell.totalCount > 0 ? emit('filter', '') : undefined"
          >
            <template v-if="cell.day !== null">
              <div class="day-top-row">
                <span class="day-num">{{ cell.day }}</span>
                <div v-if="cell.totalCount > 0" class="day-badges">
                  <em v-if="cell.confirmedCount > 0" class="badge-confirmed">
                    {{ cell.confirmedCount }}
                  </em>
                  <em v-if="cell.pendingCount > 0" class="badge-pending">
                    {{ cell.pendingCount }}
                  </em>
                </div>
              </div>
              <small v-if="cell.clientsList.length" class="day-client-preview">
                {{ cell.clientsList[0]?.replace(/\s*\([^)]*\)$/, '') }}
              </small>
              <div v-if="cell.clientsList.length" class="day-hover-popover">
                <strong>{{ formatDate(cell.dateStr) }}</strong>
                <span v-for="(clientItem, cIdx) in cell.clientsList" :key="cIdx">{{ clientItem }}</span>
              </div>
            </template>
          </div>
        </div>
      </article>

      <!-- Order Status Breakdown & Daily Activity -->
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

        <div class="sub-section">
          <div class="sub-heading">
            <span>Recent Daily Order Volume (dd-mm)</span>
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

      <!-- Upcoming Events List -->
      <article class="card full">
        <div class="heading">
          <div>
            <span class="eyebrow">Operations</span>
            <h2>
              Upcoming Events
              <em v-if="dashboard?.upcomingEvents?.length" class="count-pill">{{ dashboard.upcomingEvents.length }}</em>
            </h2>
            <small>Events scheduled over the next 30 days (Confirmed in Teal · Pending in Tan)</small>
          </div>
          <button type="button" class="link-btn" @click="emit('filter', '')">
            View all orders <ArrowUpRight :size="15" />
          </button>
        </div>

        <div v-if="dashboard?.upcomingEvents?.length" class="event-list scrollable-list">
          <button
            v-for="event in dashboard.upcomingEvents"
            :key="event.id"
            type="button"
            class="event-row"
            :class="{ confirmed: Boolean(event.is_confirmed), pending: !event.is_confirmed }"
            @click="emit('filter', '')"
          >
            <div class="event-date-badge">
              <b>{{ formatDate(event.event_date) }}</b>
              <small><MapPin :size="12" /> {{ event.location || 'Location not set' }}</small>
            </div>
            <div class="event-client">
              <b>{{ event.client_name }}</b>
              <span class="status-pill" :class="{ confirmed: Boolean(event.is_confirmed), pending: !event.is_confirmed }">
                {{ event.status_name }}
              </span>
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
            <h2>
              Outstanding Clients
              <em v-if="dashboard?.outstandingClients?.length" class="count-pill rust">{{ dashboard.outstandingClients.length }}</em>
            </h2>
          </div>
          <button v-if="dashboard?.outstandingClients?.length" type="button" class="link-btn" @click="emit('filter', 'unpaid')">
            Review <ArrowUpRight :size="14" />
          </button>
        </div>
        <div v-if="dashboard?.outstandingClients?.length" class="client-list scrollable-list">
          <button
            v-for="client in dashboard.outstandingClients"
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
            <h2>
              Top Clients by Value
              <em v-if="dashboard?.topClients?.length" class="count-pill">{{ dashboard.topClients.length }}</em>
            </h2>
          </div>
          <Users :size="18" class="muted-icon" />
        </div>
        <div v-if="dashboard?.topClients?.length" class="rank-list scrollable-list">
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
      Last updated {{ dashboard?.generatedAt ? formatDate(dashboard.generatedAt) : formatDate(new Date()) }}
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
  transition: transform 0.15s ease;
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
  color: rgba(248, 250, 229, 0.82) !important;
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

.heading,
.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}

.heading h2,
.calendar-header h2 {
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

/* Full-Month Calendar */
.calendar-controls {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.legend {
  display: flex;
  gap: 12px;
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.legend-item .dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
}

.legend-item .dot.confirmed {
  background: #43766C;
}

.legend-item .dot.pending {
  background: #B19470;
}

.month-nav {
  display: flex;
  gap: 4px;
}

.month-nav button {
  border: 1px solid var(--border);
  background: #FBFCF4;
  color: var(--text);
  border-radius: 7px;
  height: 28px;
  min-width: 28px;
  display: inline-grid;
  place-items: center;
  font-size: 11px;
  font-weight: 800;
  padding: 0 7px;
  cursor: pointer;
}

.month-nav button:hover {
  background: #43766C;
  border-color: #43766C;
  color: #F8FAE5;
}

.month-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  margin-bottom: 6px;
  text-align: center;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.day-cell {
  position: relative;
  min-height: 56px;
  border: 1px solid #EFECE0;
  border-radius: 9px;
  background: #FBFCF4;
  padding: 5px 6px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: transform 0.12s ease, border-color 0.12s ease;
}

.day-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2px;
}

.day-client-preview {
  display: block;
  font-size: 9px;
  font-weight: 700;
  color: #26211D;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.day-hover-popover {
  display: none;
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  min-width: 170px;
  max-width: 240px;
  background: #26211D;
  color: #F8FAE5;
  padding: 8px 10px;
  border-radius: 9px;
  box-shadow: 0 10px 24px rgba(38, 33, 29, 0.28);
  font-size: 11px;
  pointer-events: none;
}

.day-hover-popover strong {
  display: block;
  font-size: 10px;
  color: #B19470;
  margin-bottom: 4px;
  border-bottom: 1px solid rgba(248, 250, 229, 0.15);
  padding-bottom: 3px;
}

.day-hover-popover span {
  display: block;
  font-weight: 600;
  line-height: 1.4;
}

.day-cell:hover .day-hover-popover {
  display: block;
}

.day-cell.empty {
  background: transparent;
  border-color: transparent;
}

.day-cell.today {
  border: 2px solid #43766C;
  background: #F8FAE5;
}

.day-cell.has-confirmed {
  background: #E9F1EF;
  border-color: #43766C;
  cursor: pointer;
}

.day-cell.has-pending {
  background: #F4EFE8;
  border-color: #B19470;
  cursor: pointer;
}

.day-cell.has-mixed {
  background: linear-gradient(135deg, #E9F1EF 0%, #F4EFE8 100%);
  border-color: #43766C;
  cursor: pointer;
}

.day-num {
  font-size: 11.5px;
  font-weight: 800;
  color: var(--text);
}

.day-badges {
  display: flex;
  gap: 3px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.badge-confirmed,
.badge-pending {
  font-style: normal;
  font-size: 9.5px;
  font-weight: 800;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 99px;
  display: inline-grid;
  place-items: center;
  line-height: 1;
}

.badge-confirmed {
  background: #43766C;
  color: #F8FAE5;
}

.badge-pending {
  background: #B19470;
  color: #F8FAE5;
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
  height: 86px;
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
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.status-summary-box > div {
  background: #F8FAE5;
  border: 1px solid #E5DEC9;
  border-radius: 10px;
  padding: 11px 14px;
}

.status-summary-box small {
  display: block;
  font-size: 11px;
  color: var(--muted);
  font-weight: 700;
}

.status-summary-box strong {
  display: block;
  font-size: 19px;
  font-weight: 800;
  color: #43766C;
  margin-top: 3px;
}

/* Upcoming Events & Scrollable Card Lists */
.count-pill {
  display: inline-grid;
  place-items: center;
  font-style: normal;
  font-size: 11px;
  font-weight: 800;
  min-width: 22px;
  height: 20px;
  padding: 0 7px;
  margin-left: 6px;
  border-radius: 99px;
  background: #E9F1EF;
  color: #43766C;
  vertical-align: middle;
}

.count-pill.rust {
  background: #F6ECEA;
  color: #76453B;
}

.scrollable-list {
  max-height: 265px;
  overflow-y: auto;
  padding-right: 6px;
  scrollbar-width: thin;
  scrollbar-color: #B19470 #F8FAE5;
}

.scrollable-list::-webkit-scrollbar {
  width: 6px;
}

.scrollable-list::-webkit-scrollbar-track {
  background: #F8FAE5;
  border-radius: 99px;
}

.scrollable-list::-webkit-scrollbar-thumb {
  background: #B19470;
  border-radius: 99px;
}

.scrollable-list::-webkit-scrollbar-thumb:hover {
  background: #43766C;
}

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
  border-left: 4px solid #B19470;
  border-radius: 11px;
  background: #FBFCF4;
  padding: 12px 16px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.event-row.confirmed {
  border-left-color: #43766C;
}

.event-row.pending {
  border-left-color: #B19470;
}

.event-row:hover {
  background: #F8FAE5;
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
  background: #F4EFE8;
  color: #76453B;
  font-size: 11px;
  font-weight: 800;
}

.status-pill.confirmed {
  background: #43766C;
  color: #F8FAE5;
}

.status-pill.pending {
  background: #B19470;
  color: #F8FAE5;
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
