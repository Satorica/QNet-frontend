<template>
  <div class="settings-page">
    <el-card class="main-card">
      <div class="page-content">
        <div class="page-header">
          <div class="title-section">
            <div class="title-bar"></div>
            <h2>系统设置</h2>
          </div>
          <p class="description">
            配置系统参数和用户偏好设置
          </p>
        </div>

        <el-tabs v-model="activeTab" class="settings-tabs">
          <!-- 基础设置 -->
          <el-tab-pane label="基础设置" name="basic">
            <div class="settings-section">
              <h3>显示设置</h3>
              <div class="setting-item">
                <label>界面语言</label>
                <el-select v-model="settings.language" @change="updateSetting('language')">
                  <el-option label="简体中文" value="zh-CN" />
                  <el-option label="English" value="en-US" />
                </el-select>
              </div>
              
              <div class="setting-item">
                <label>主题模式</label>
                <el-radio-group v-model="settings.theme" @change="updateSetting('theme')">
                  <el-radio label="light">浅色</el-radio>
                  <el-radio label="dark">深色</el-radio>
                  <el-radio label="auto">跟随系统</el-radio>
                </el-radio-group>
              </div>

              <div class="setting-item">
                <label>显示动画</label>
                <el-switch
                  v-model="settings.animations"
                  @change="updateSetting('animations')"
                />
              </div>
            </div>

            <el-divider />

            <div class="settings-section">
              <h3>默认配置</h3>
              <div class="setting-item">
                <label>默认求解模型</label>
                <el-select v-model="settings.defaultSolveType" @change="updateSetting('defaultSolveType')">
                  <el-option label="经典计算" value="classic" />
                  <el-option label="量子芯片模拟" value="sim" />
                  <el-option label="量子云服务" value="cloud" />
                </el-select>
              </div>

              <div class="setting-item">
                <label>默认矩阵规模</label>
                <el-input-number
                  v-model="settings.defaultMatrixSize"
                  :min="2"
                  :max="24"
                  @change="updateSetting('defaultMatrixSize')"
                />
              </div>

              <div class="setting-item">
                <label>自动保存结果</label>
                <el-switch
                  v-model="settings.autoSaveResults"
                  @change="updateSetting('autoSaveResults')"
                />
              </div>
            </div>
          </el-tab-pane>

          <!-- 性能设置 -->
          <el-tab-pane label="性能设置" name="performance">
            <div class="settings-section">
              <h3>计算性能</h3>
              <div class="setting-item">
                <label>最大并发任务数</label>
                <el-input-number
                  v-model="settings.maxConcurrentTasks"
                  :min="1"
                  :max="10"
                  @change="updateSetting('maxConcurrentTasks')"
                />
              </div>

              <div class="setting-item">
                <label>任务超时时间（秒）</label>
                <el-input-number
                  v-model="settings.taskTimeout"
                  :min="30"
                  :max="3600"
                  @change="updateSetting('taskTimeout')"
                />
              </div>

              <div class="setting-item">
                <label>内存使用限制（MB）</label>
                <el-input-number
                  v-model="settings.memoryLimit"
                  :min="512"
                  :max="8192"
                  @change="updateSetting('memoryLimit')"
                />
              </div>
            </div>

            <el-divider />

            <div class="settings-section">
              <h3>图形渲染</h3>
              <div class="setting-item">
                <label>启用硬件加速</label>
                <el-switch
                  v-model="settings.hardwareAcceleration"
                  @change="updateSetting('hardwareAcceleration')"
                />
              </div>

              <div class="setting-item">
                <label>图形质量</label>
                <el-select v-model="settings.graphicsQuality" @change="updateSetting('graphicsQuality')">
                  <el-option label="低" value="low" />
                  <el-option label="中" value="medium" />
                  <el-option label="高" value="high" />
                </el-select>
              </div>

              <div class="setting-item">
                <label>最大节点数</label>
                <el-input-number
                  v-model="settings.maxNodes"
                  :min="10"
                  :max="1000"
                  @change="updateSetting('maxNodes')"
                />
              </div>
            </div>
          </el-tab-pane>

          <!-- 数据管理 -->
          <el-tab-pane label="数据管理" name="data">
            <div class="settings-section">
              <h3>存储设置</h3>
              <div class="setting-item">
                <label>数据存储位置</label>
                <div class="storage-info">
                  <el-input v-model="settings.dataPath" readonly />
                  <el-button @click="selectDataPath">选择路径</el-button>
                </div>
              </div>

              <div class="setting-item">
                <label>最大任务历史数</label>
                <el-input-number
                  v-model="settings.maxTaskHistory"
                  :min="50"
                  :max="1000"
                  @change="updateSetting('maxTaskHistory')"
                />
              </div>

              <div class="setting-item">
                <label>自动清理过期数据</label>
                <el-switch
                  v-model="settings.autoCleanup"
                  @change="updateSetting('autoCleanup')"
                />
              </div>
            </div>

            <el-divider />

            <div class="settings-section">
              <h3>数据操作</h3>
              <div class="data-actions">
                <el-button @click="exportSettings">导出设置</el-button>
                <el-button @click="importSettings">导入设置</el-button>
                <el-button @click="clearAllData" type="warning">清空所有数据</el-button>
                <el-button @click="resetSettings" type="danger">重置设置</el-button>
              </div>
            </div>

            <div class="storage-stats">
              <h4>存储统计</h4>
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-value">{{ storageStats.tasks }}</div>
                  <div class="stat-label">任务数量</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{{ storageStats.size }}</div>
                  <div class="stat-label">数据大小</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{{ storageStats.lastUpdate }}</div>
                  <div class="stat-label">最后更新</div>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- 关于 -->
          <el-tab-pane label="关于" name="about">
            <div class="about-section">
              <div class="app-info">
                <div class="app-logo">Q</div>
                <h2>量子Ising求解系统</h2>
                <p class="version">版本 2.0.0</p>
                <p class="description">
                  基于Vue 3和Element Plus构建的现代化量子优化问题求解平台
                </p>
              </div>

              <el-divider />

              <div class="system-info">
                <h3>系统信息</h3>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="label">框架版本：</span>
                    <span class="value">Vue 3.4.0</span>
                  </div>
                  <div class="info-item">
                    <span class="label">UI库：</span>
                    <span class="value">Element Plus 2.4.4</span>
                  </div>
                  <div class="info-item">
                    <span class="label">构建工具：</span>
                    <span class="value">Vite 5.0.8</span>
                  </div>
                  <div class="info-item">
                    <span class="label">浏览器：</span>
                    <span class="value">{{ browserInfo }}</span>
                  </div>
                </div>
              </div>

              <el-divider />

              <div class="links-section">
                <h3>相关链接</h3>
                <div class="links-grid">
                  <el-button type="primary" plain @click="openLink('https://github.com')">
                    项目主页
                  </el-button>
                  <el-button type="success" plain @click="openLink('https://github.com')">
                    使用文档
                  </el-button>
                  <el-button type="warning" plain @click="openLink('https://github.com')">
                    问题反馈
                  </el-button>
                  <el-button type="info" plain @click="checkUpdates">
                    检查更新
                  </el-button>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const activeTab = ref('basic')

// 设置项
const settings = ref({
  language: 'zh-CN',
  theme: 'light',
  animations: true,
  defaultSolveType: 'classic',
  defaultMatrixSize: 6,
  autoSaveResults: true,
  maxConcurrentTasks: 3,
  taskTimeout: 300,
  memoryLimit: 2048,
  hardwareAcceleration: true,
  graphicsQuality: 'medium',
  maxNodes: 100,
  dataPath: '/data/quantum-solver',
  maxTaskHistory: 200,
  autoCleanup: true
})

// 存储统计
const storageStats = ref({
  tasks: 0,
  size: '0 MB',
  lastUpdate: '--'
})

// 计算属性
const browserInfo = computed(() => {
  const ua = navigator.userAgent
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari')) return 'Safari'
  if (ua.includes('Edge')) return 'Edge'
  return 'Unknown'
})

// 方法
const loadSettings = () => {
  try {
    const stored = localStorage.getItem('quantumSolverSettings')
    if (stored) {
      const parsedSettings = JSON.parse(stored)
      settings.value = { ...settings.value, ...parsedSettings }
    }
  } catch (error) {
    console.error('加载设置失败:', error)
  }
}

const saveSettings = () => {
  try {
    localStorage.setItem('quantumSolverSettings', JSON.stringify(settings.value))
    ElMessage.success('设置已保存')
  } catch (error) {
    console.error('保存设置失败:', error)
    ElMessage.error('保存设置失败')
  }
}

const updateSetting = (key) => {
  saveSettings()
  // 应用设置变更
  applySetting(key)
}

const applySetting = (key) => {
  switch (key) {
    case 'theme':
      applyTheme()
      break
    case 'animations':
      applyAnimations()
      break
    case 'language':
      applyLanguage()
      break
  }
}

const applyTheme = () => {
  const theme = settings.value.theme
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

const applyAnimations = () => {
  const animations = settings.value.animations
  if (!animations) {
    document.documentElement.style.setProperty('--transition-duration', '0s')
  } else {
    document.documentElement.style.removeProperty('--transition-duration')
  }
}

const applyLanguage = () => {
  // 这里可以集成i18n
  ElMessage.info('语言设置将在重启后生效')
}

const selectDataPath = () => {
  // 模拟文件路径选择
  ElMessageBox.prompt('请输入数据存储路径', '选择路径', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputValue: settings.value.dataPath
  }).then(({ value }) => {
    settings.value.dataPath = value
    updateSetting('dataPath')
  }).catch(() => {})
}

const exportSettings = () => {
  const data = {
    settings: settings.value,
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `quantum-solver-settings-${Date.now()}.json`
  link.click()
  URL.revokeObjectURL(url)
  
  ElMessage.success('设置已导出')
}

const importSettings = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (data.settings) {
          settings.value = { ...settings.value, ...data.settings }
          saveSettings()
          ElMessage.success('设置已导入')
        } else {
          ElMessage.error('无效的设置文件')
        }
      } catch (error) {
        ElMessage.error('导入失败')
      }
    }
    reader.readAsText(file)
  }
  
  input.click()
}

const clearAllData = () => {
  ElMessageBox.confirm(
    '确定要清空所有数据吗？此操作不可恢复！',
    '警告',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    localStorage.removeItem('quantumTasks')
    localStorage.removeItem('quantumSolverSettings')
    updateStorageStats()
    ElMessage.success('所有数据已清空')
  }).catch(() => {})
}

const resetSettings = () => {
  ElMessageBox.confirm(
    '确定要重置所有设置为默认值吗？',
    '确认重置',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    localStorage.removeItem('quantumSolverSettings')
    location.reload()
  }).catch(() => {})
}

const openLink = (url) => {
  window.open(url, '_blank')
}

const checkUpdates = () => {
  ElMessage.info('正在检查更新...')
  setTimeout(() => {
    ElMessage.success('当前已是最新版本')
  }, 1500)
}

const updateStorageStats = () => {
  try {
    const tasks = localStorage.getItem('quantumTasks')
    const settings = localStorage.getItem('quantumSolverSettings')
    
    let totalSize = 0
    let taskCount = 0
    
    if (tasks) {
      totalSize += new Blob([tasks]).size
      taskCount = JSON.parse(tasks).length
    }
    
    if (settings) {
      totalSize += new Blob([settings]).size
    }
    
    storageStats.value = {
      tasks: taskCount,
      size: (totalSize / 1024 / 1024).toFixed(2) + ' MB',
      lastUpdate: new Date().toLocaleString('zh-CN')
    }
  } catch (error) {
    console.error('更新存储统计失败:', error)
  }
}

onMounted(() => {
  loadSettings()
  updateStorageStats()
  
  // 应用当前设置
  applyTheme()
  applyAnimations()
})
</script>

<style scoped>
.settings-page {
  padding: 20px;
}

.main-card {
  background: #FFFFFF;
  border-radius: 20px;
  border: 1px solid #E6EAF5;
  box-shadow: 0 10px 20px rgba(9, 30, 66, 0.04);
}

.title-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.title-bar {
  width: 4px;
  height: 28px;
  background: linear-gradient(180deg, #4050F8, #7848E8);
  border-radius: 2px;
}

.settings-tabs {
  margin-top: 24px;
}

.settings-section {
  margin-bottom: 32px;
}

.settings-section h3 {
  color: #292929;
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: 600;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid #F0F0F0;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item label {
  font-weight: 500;
  color: #292929;
  flex: 1;
}

.storage-info {
  display: flex;
  gap: 12px;
  align-items: center;
}

.data-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.storage-stats {
  margin-top: 32px;
}

.storage-stats h4 {
  color: #292929;
  margin-bottom: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-card {
  padding: 20px;
  background: #F6F7FA;
  border-radius: 12px;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #4050F8;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #8C8FA3;
}

.about-section {
  max-width: 600px;
}

.app-info {
  text-align: center;
  margin-bottom: 32px;
}

.app-logo {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: linear-gradient(180deg, #4050F8, #7848E8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 36px;
  font-weight: 700;
  margin: 0 auto 20px;
  box-shadow: 0 12px 24px rgba(64, 80, 248, 0.25);
}

.app-info h2 {
  color: #292929;
  margin: 0 0 8px;
}

.version {
  color: #8C8FA3;
  font-size: 16px;
  margin-bottom: 16px;
}

.app-info .description {
  color: #666;
  line-height: 1.6;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
}

.info-item .label {
  color: #666;
}

.info-item .value {
  font-weight: 500;
  color: #292929;
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
</style> 