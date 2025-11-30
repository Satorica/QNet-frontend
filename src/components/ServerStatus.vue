<template>
  <div class="server-status">
    <div class="status-header">
      <h3>服务器状态</h3>
      <button @click="refreshStatus" :disabled="checking" class="refresh-btn">
        <span v-if="checking">检查中...</span>
        <span v-else>刷新状态</span>
      </button>
    </div>
    
    <div class="servers-grid">
      <!-- 云服务器状态 -->
      <div class="server-card" :class="{ online: cloudStatus.online, offline: !cloudStatus.online }">
        <div class="server-header">
          <div class="server-icon">☁️</div>
          <div class="server-info">
            <h4>云服务器</h4>
            <p class="server-url">120.55.188.36:5000</p>
          </div>
          <div class="status-indicator" :class="{ online: cloudStatus.online }">
            {{ cloudStatus.online ? '在线' : '离线' }}
          </div>
        </div>
        
        <div class="server-details" v-if="cloudStatus.online && cloudDetails">
          <div class="detail-item">
            <span class="label">活跃任务:</span>
            <span class="value">{{ cloudDetails.active_tasks || 0 }}</span>
          </div>
          <div class="detail-item">
            <span class="label">队列长度:</span>
            <span class="value">{{ cloudDetails.queue_size || 0 }}</span>
          </div>
          <div class="detail-item">
            <span class="label">本地服务器:</span>
            <span class="value" :class="{ online: cloudDetails.local_server?.online }">
              {{ cloudDetails.local_server?.online ? '连接正常' : '连接异常' }}
            </span>
          </div>
        </div>
        
        <div class="server-features">
          <span class="feature">任务队列管理</span>
          <span class="feature">负载均衡</span>
          <span class="feature">状态监控</span>
        </div>
      </div>

      <!-- 本地服务器状态 -->
      <div class="server-card" :class="{ online: localStatus.online, offline: !localStatus.online }">
        <div class="server-header">
          <div class="server-icon">🖥️</div>
          <div class="server-info">
            <h4>本地计算服务器</h4>
            <p class="server-url">172.19.34.10:18 (via tunnel)</p>
          </div>
          <div class="status-indicator" :class="{ online: localStatus.online }">
            {{ localStatus.online ? '在线' : '离线' }}
          </div>
        </div>
        
        <div class="server-details" v-if="localStatus.online && localDetails">
          <div class="detail-item">
            <span class="label">服务器类型:</span>
            <span class="value">{{ localDetails.server_type || 'N/A' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">支持算法:</span>
            <span class="value">{{ localDetails.capabilities?.join(', ') || 'N/A' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">最大矩阵:</span>
            <span class="value">{{ localDetails.max_matrix_size || 'N/A' }}</span>
          </div>
        </div>
        
        <div class="server-features">
          <span class="feature">高性能计算</span>
          <span class="feature">直接处理</span>
          <span class="feature">快速响应</span>
        </div>
      </div>
    </div>

    <!-- 通信模式说明 -->
    <div class="communication-info">
      <h4>通信策略</h4>
      <div class="strategy-item">
        <strong>推荐模式:</strong> 云服务器 → 本地服务器
        <p>任务通过云服务器队列管理，自动分发到本地服务器进行计算</p>
      </div>
      <div class="strategy-item">
        <strong>备用模式:</strong> 直连本地服务器
        <p>当云服务器不可用时，直接连接本地服务器进行计算</p>
      </div>
    </div>

    <!-- 最后检查时间 -->
    <div class="last-check">
      <p>最后检查时间: {{ formatTime(lastCheckTime) }}</p>
    </div>
  </div>
</template>

<script>
import { checkServerStatus, getServerStatus, cloudApi, localApi } from '@/api'

export default {
  name: 'ServerStatus',
  data() {
    return {
      checking: false,
      cloudStatus: { online: false },
      localStatus: { online: false },
      cloudDetails: null,
      localDetails: null,
      lastCheckTime: null,
      autoRefreshTimer: null
    }
  },
  
  async mounted() {
    await this.refreshStatus()
    // 设置自动刷新，每30秒检查一次
    this.autoRefreshTimer = setInterval(() => {
      this.refreshStatus()
    }, 30000)
  },
  
  beforeUnmount() {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer)
    }
  },
  
  methods: {
    async refreshStatus() {
      this.checking = true
      try {
        // 检查基础连接状态
        const status = await checkServerStatus()
        this.cloudStatus = { online: status.cloud }
        this.localStatus = { online: status.local }
        
        // 获取详细信息
        if (status.cloud) {
          try {
            const cloudResponse = await cloudApi.get('/server-status')
            if (cloudResponse.data.success) {
              this.cloudDetails = {
                active_tasks: cloudResponse.data.cloud_server?.active_tasks,
                queue_size: cloudResponse.data.cloud_server?.queue_size,
                local_server: cloudResponse.data.local_server
              }
            }
          } catch (error) {
            console.warn('获取云服务器详细信息失败:', error)
          }
        }
        
        if (status.local) {
          try {
            const localResponse = await localApi.get('/server-info')
            if (localResponse.data.success) {
              this.localDetails = localResponse.data
            }
          } catch (error) {
            console.warn('获取本地服务器详细信息失败:', error)
          }
        }
        
        this.lastCheckTime = new Date()
        
        // 向父组件发送状态更新
        this.$emit('status-updated', {
          cloud: this.cloudStatus.online,
          local: this.localStatus.online
        })
        
      } catch (error) {
        console.error('检查服务器状态失败:', error)
        this.$emit('status-error', error)
      } finally {
        this.checking = false
      }
    },
    
    formatTime(time) {
      if (!time) return '未检查'
      return time.toLocaleTimeString('zh-CN')
    }
  }
}
</script>

<style scoped>
.server-status {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.status-header h3 {
  margin: 0;
  color: #2c3e50;
}

.refresh-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.refresh-btn:hover:not(:disabled) {
  background: #2980b9;
}

.refresh-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.servers-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.server-card {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s ease;
}

.server-card.online {
  border-color: #27ae60;
  background: #f8fff8;
}

.server-card.offline {
  border-color: #e74c3c;
  background: #fff8f8;
}

.server-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.server-icon {
  font-size: 24px;
  margin-right: 12px;
}

.server-info {
  flex: 1;
}

.server-info h4 {
  margin: 0 0 4px 0;
  color: #2c3e50;
  font-size: 16px;
}

.server-url {
  margin: 0;
  color: #7f8c8d;
  font-size: 12px;
  font-family: 'Courier New', monospace;
}

.status-indicator {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  background: #e74c3c;
  color: white;
}

.status-indicator.online {
  background: #27ae60;
}

.server-details {
  margin: 12px 0;
  padding: 8px;
  background: rgba(255,255,255,0.8);
  border-radius: 4px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.detail-item .label {
  color: #7f8c8d;
  font-size: 12px;
}

.detail-item .value {
  font-weight: bold;
  font-size: 12px;
}

.detail-item .value.online {
  color: #27ae60;
}

.server-features {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.feature {
  background: #ecf0f1;
  color: #2c3e50;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  border: 1px solid #bdc3c7;
}

.communication-info {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 16px;
}

.communication-info h4 {
  margin: 0 0 12px 0;
  color: #2c3e50;
}

.strategy-item {
  margin-bottom: 12px;
}

.strategy-item strong {
  color: #3498db;
}

.strategy-item p {
  margin: 4px 0 0 0;
  color: #7f8c8d;
  font-size: 14px;
}

.last-check {
  text-align: center;
  color: #95a5a6;
  font-size: 12px;
  border-top: 1px solid #ecf0f1;
  padding-top: 12px;
}

.last-check p {
  margin: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .servers-grid {
    grid-template-columns: 1fr;
  }
  
  .status-header {
    flex-direction: column;
    gap: 10px;
  }
}
</style> 