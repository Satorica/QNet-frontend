<template>
  <div class="topbar">
    <div class="top-left">
      <div class="task-input">
        <el-input
          v-model="taskName"
          placeholder="请输入任务名："
          style="width: 300px"
        />
        <el-button type="primary" @click="handleOk">OK</el-button>
      </div>
    </div>

    <div class="top-right">
      <div class="time-wrap">
        <div class="time">{{ currentTime }}</div>
        <div class="date">{{ currentDate }}</div>
      </div>
      <div class="avatar">王</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const taskName = ref('')
const currentTime = ref('')
const currentDate = ref('')
let timer = null

const updateClock = () => {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  
  currentTime.value = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  currentDate.value = `${days[now.getDay()]} ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const handleOk = () => {
  if (taskName.value.trim()) {
    console.log('创建任务:', taskName.value)
    // 触发任务创建事件
    // emit('create-task', taskName.value)
    taskName.value = ''
  }
}

onMounted(() => {
  updateClock()
  timer = setInterval(updateClock, 1000)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<style scoped>
.topbar {
  height: 70px;
  background: #FFFFFF;
  border-radius: 16px;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 12px rgba(9, 30, 66, 0.08);
  border: 1px solid #E6EAF5;
}

.task-input {
  display: flex;
  gap: 12px;
  align-items: center;
}

.top-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.time-wrap {
  text-align: right;
}

.time {
  font-size: 18px;
  font-weight: 600;
  color: #292929;
}

.date {
  font-size: 12px;
  color: #8C8FA3;
  margin-top: 2px;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4050F8, #7848E8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 14px;
}
</style> 