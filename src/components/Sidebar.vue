<template>
  <div class="sidebar" :class="{ collapsed }">
    <div class="sidebar-brand">
      <img class="brand-mark" :src="brandLogo" :alt="collapsed ? '量子 Ising 求解系统' : ''" />
      <div v-if="!collapsed" class="brand">
        <div class="title">量子 Ising 求解系统</div>
        <div class="subtitle">可视化求解与任务管理</div>
      </div>
    </div>

    <nav class="sidebar-navigation" aria-label="主导航">
      <section
        v-for="group in menuGroups"
        :key="group.title"
        class="menu-section"
        :aria-label="group.title"
      >
        <h2 v-if="!collapsed" class="menu-section-title">{{ group.title }}</h2>
        <ul class="nav-menu">
          <li v-for="item in group.items" :key="item.path">
            <el-tooltip
              :content="item.label"
              :disabled="!collapsed"
              :trigger="['hover', 'focus']"
              :trigger-keys="[]"
              placement="right"
              effect="light"
              :show-after="150"
            >
              <router-link
                :to="item.path"
                :target="item.path === '/api-center' ? '_blank' : undefined"
                :rel="item.path === '/api-center' ? 'noopener' : undefined"
                class="nav-item"
                :class="{ 'is-active': activeMenu === item.path }"
                :aria-label="item.label"
                :aria-current="activeMenu === item.path ? 'page' : undefined"
              >
                <el-icon aria-hidden="true"><component :is="item.icon" /></el-icon>
                <span v-if="!collapsed" class="menu-label">{{ item.label }}</span>
                <span v-if="activeMenu === item.path && !collapsed" class="menu-current" aria-hidden="true"></span>
              </router-link>
            </el-tooltip>
          </li>
        </ul>
      </section>
    </nav>

    <div class="sidebar-footer">
      <button
        type="button"
        class="sidebar-toggle"
        :aria-label="collapsed ? '展开菜单栏' : '折叠菜单栏'"
        :aria-expanded="!collapsed"
        :title="collapsed ? '展开菜单栏' : '折叠菜单栏'"
        @click="$emit('toggle-collapse')"
      >
        <el-icon :size="18"><Expand v-if="collapsed" /><Fold v-else /></el-icon>
        <span v-if="!collapsed">折叠菜单</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DataLine, Odometer, MagicStick, Location, DataAnalysis, List, Document, ChatDotRound, Key, Expand, Fold } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import brandLogo from '../assets/brand-logo.svg'

const { collapsed = false } = defineProps<{ collapsed?: boolean }>()
defineEmits<{ (event: 'toggle-collapse'): void }>()

const menuGroups = [
  {
    title: '问题求解',
    items: [
      { path: '/maxcut', label: '图分割问题', icon: DataLine },
      { path: '/number', label: '数分问题', icon: Odometer },
      { path: '/coloring', label: '图着色问题', icon: MagicStick },
      { path: '/tsp', label: '旅行商问题', icon: Location },
      { path: '/general', label: '一般问题', icon: DataAnalysis },
    ],
  },
  {
    title: '工作台',
    items: [
      { path: '/tasks', label: '任务情况', icon: List },
      { path: '/quota-requests', label: '我的申请', icon: Document },
      { path: '/api-center', label: 'API 中心', icon: Key },
      { path: '/feedback', label: '问题反馈', icon: ChatDotRound },
    ],
  },
]

const route = useRoute()
const activeMenu = computed(() => {
  if (route.path.startsWith('/feedback')) return '/feedback'
  return route.path
})
</script>

<style scoped>
.sidebar {
  --sidebar-ink: #263b52;
  --sidebar-muted: #65758b;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  /* Keep Chinese and Latin navigation labels in the same local typeface. */
  font-family: "PingFang SC", "Microsoft YaHei", "Microsoft YaHei UI", "Noto Sans CJK SC", "Hiragino Sans GB", "WenQuanYi Micro Hei", sans-serif;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  min-height: 44px;
  padding: 0 4px 18px;
  border-bottom: 1px solid var(--app-border);
}

.brand {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.title {
  color: var(--sidebar-ink);
  font-size: var(--app-font-body);
  font-weight: var(--app-weight-semibold);
  line-height: 1.5;
  white-space: nowrap;
  letter-spacing: 0;
}

.subtitle {
  color: var(--sidebar-muted);
  font-size: var(--app-font-caption);
  line-height: 1.5;
  white-space: nowrap;
  letter-spacing: 0;
}

.brand-mark {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.sidebar-navigation {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 0 16px;
  scrollbar-width: thin;
  scrollbar-color: var(--app-border) transparent;
}

.menu-section + .menu-section { margin-top: 26px; }

.menu-section-title {
  margin: 0 10px 8px;
  color: var(--sidebar-muted);
  font-size: var(--app-font-caption);
  font-weight: var(--app-weight-regular);
  line-height: 18px;
  letter-spacing: 0;
}

.menu-section + .menu-section .menu-section-title {
  padding-bottom: 10px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--app-border);
}

.nav-menu { width: 100%; padding: 0; margin: 0; list-style: none; }

.nav-item {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 44px;
  line-height: 22px;
  padding: 0 12px;
  margin: 3px 0;
  border-radius: 11px;
  color: var(--sidebar-ink);
  font-size: var(--app-font-subtitle);
  font-weight: var(--app-weight-regular);
  text-decoration: none;
  transition: background-color .18s, color .18s, box-shadow .18s;
}

.nav-item .el-icon {
  flex-shrink: 0;
  width: 20px;
  margin-right: 0;
  font-size: 19px;
  color: inherit;
}

.menu-label { flex: 1; min-width: 0; }

.menu-current {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.nav-item:hover {
  background-color: rgba(var(--app-accent-rgb), .045);
  color: var(--app-accent);
}

.nav-item.is-active,
.nav-item.is-active:hover {
  background: var(--app-accent-soft);
  color: var(--app-accent) !important;
  font-weight: var(--app-weight-medium);
}

.nav-item:focus-visible {
  outline: 2px solid var(--app-accent);
  outline-offset: -2px;
}

.sidebar-footer {
  flex-shrink: 0;
  padding-top: 14px;
  border-top: 1px solid var(--app-border);
}

.sidebar-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border: 1px solid var(--app-border);
  border-radius: 11px;
  background: rgba(255, 255, 255, .65);
  color: var(--sidebar-muted);
  font: inherit;
  font-size: var(--app-font-subtitle);
  cursor: pointer;
  transition: background-color .18s, color .18s, border-color .18s;
}

.sidebar-toggle .el-icon { flex-shrink: 0; width: 20px; }
.sidebar-toggle:hover { background: var(--app-accent-soft); border-color: var(--el-color-primary-light-5); color: var(--app-accent); }
.sidebar-toggle:focus-visible { outline: 2px solid var(--app-accent); outline-offset: -2px; }
.collapsed .sidebar-brand { justify-content: center; padding-right: 0; padding-left: 0; }

.collapsed .menu-section + .menu-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--app-border);
}

.collapsed .sidebar-toggle,
.collapsed .nav-item { justify-content: center; gap: 0; padding: 0; }

@media (prefers-reduced-motion: reduce) {
  .nav-item, .sidebar-toggle { transition: none; }
}
</style>
