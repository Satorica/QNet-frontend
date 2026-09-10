import { readonly, ref } from 'vue'

export const themes = [
  // Retain the legacy id for saved Deep Space Blue preferences.
  { id: 'violet', name: '深空蓝', primary: '#3564ad', secondary: '#426fb5' },
  { id: 'jade', name: '翡翠绿', primary: '#138568', secondary: '#319b75' },
  { id: 'sunset', name: '暖阳橙', primary: '#c65d20', secondary: '#dd8a30' },
  { id: 'rose', name: '玫瑰粉', primary: '#b84470', secondary: '#bb5276' },
  { id: 'iris', name: '鸢尾紫', primary: '#8053b5', secondary: '#9255ae' },
  { id: 'teal', name: '孔雀青', primary: '#087d91', secondary: '#14818d' },
  { id: 'slate', name: '雾霭灰', primary: '#56677e', secondary: '#637187' },
] as const

type ThemeId = typeof themes[number]['id']
const STORAGE_KEY = 'quantum-ising-theme'
const DEFAULT_THEME_ID: ThemeId = 'iris'
const currentTheme = ref<ThemeId>(DEFAULT_THEME_ID)

const findTheme = (id: unknown) => themes.find((theme) => theme.id === id)

function applyTheme(id: ThemeId) {
  const theme = findTheme(id)!
  const root = document.documentElement
  const isDeepSpaceBlue = id === 'violet'
  const rgb = [1, 3, 5].map((offset) => parseInt(theme.primary.slice(offset, offset + 2), 16))
  const mix = (weight: number, target = 255) =>
    `rgb(${rgb.map((channel) => Math.round(channel * (1 - weight) + target * weight)).join(', ')})`

  root.dataset.theme = id
  root.style.setProperty('--el-color-primary', theme.primary)
  for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    root.style.setProperty(`--el-color-primary-light-${level}`, mix(level / 10))
  }
  root.style.setProperty('--el-color-primary-dark-2', mix(0.2, 0))
  root.style.setProperty('--app-accent-secondary', theme.secondary)
  root.style.setProperty('--app-accent-rgb', rgb.join(', '))
  root.style.setProperty('--app-page-start', isDeepSpaceBlue ? '#f5f7fb' : mix(0.96))
  root.style.setProperty('--app-page-end', isDeepSpaceBlue ? '#fbfcfd' : mix(0.99))
  root.style.setProperty('--app-sidebar-start', isDeepSpaceBlue ? '#f1f5fa' : mix(0.95))
  root.style.setProperty('--app-border', isDeepSpaceBlue ? '#e0e7f0' : mix(0.87))
  currentTheme.value = id
}

// Restore before mounting so the first application frame uses the saved skin.
export function initializeTheme() {
  // Authentication keeps the default brand palette even when a different skin is saved.
  const root = document.documentElement
  const primary = findTheme(DEFAULT_THEME_ID)!.primary
  const rgb = [1, 3, 5].map((offset) => parseInt(primary.slice(offset, offset + 2), 16))
  root.style.setProperty('--brand-primary', primary)
  root.style.setProperty('--brand-rgb', rgb.join(', '))
  for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    root.style.setProperty(`--brand-primary-light-${level}`,
      `rgb(${rgb.map((channel) => Math.round(channel * (1 - level / 10) + 255 * level / 10)).join(', ')})`)
  }
  root.style.setProperty('--brand-primary-dark-2',
    `rgb(${rgb.map((channel) => Math.round(channel * 0.8)).join(', ')})`)
  let saved: string | null = null
  try {
    saved = localStorage.getItem(STORAGE_KEY)
  } catch {
    // Restricted browser storage should not prevent the application from loading.
  }
  applyTheme(findTheme(saved)?.id ?? DEFAULT_THEME_ID)
}

function setTheme(id: unknown) {
  const theme = findTheme(id)
  if (!theme) return
  applyTheme(theme.id)
  try {
    localStorage.setItem(STORAGE_KEY, theme.id)
  } catch {
    // Switching still works for this session when persistence is unavailable.
  }
}

export function useTheme() {
  return { currentTheme: readonly(currentTheme), themes, setTheme }
}
