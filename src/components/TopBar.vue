<template>
  <div class="topbar">
    <div class="top-right">
      <div class="time-wrap">
        <div class="time">{{ currentTime }}</div>
        <div class="date-col">
          <div class="weekday">{{ currentWeekday }}</div>
          <div class="date-line">{{ currentDateOnly }}</div>
        </div>
      </div>

      <ThemeSwitcher />

      <!-- 用户信息和菜单 -->
      <el-dropdown v-if="isLoggedIn" @command="handleCommand" trigger="click">
        <button type="button" class="user-info" :aria-label="`个人资料：${displayName}`">
          <img class="avatar" :src="defaultAvatar" alt="" width="26" height="26" />
          <span class="username">{{
            displayName
          }}</span>
          <el-icon class="user-chevron" aria-hidden="true"><ArrowDown /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item disabled>
              <div class="user-details">
                <div>
                  <strong>昵称:</strong>
                  {{ displayName }}
                </div>
                <div v-if="userInfo?.maskedEmail">
                  <strong>邮箱:</strong>
                  {{ userInfo?.maskedEmail }}
                </div>
                <div v-if="userInfo?.maskedPhone">
                  <strong>手机:</strong>
                  {{ userInfo?.maskedPhone }}
                </div>
              </div>
            </el-dropdown-item>
            <el-dropdown-item divided command="logout">
              <el-icon><SwitchButton /></el-icon>
              <span>退出登录</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- 未登录时显示 -->
      <div v-else class="login-prompt">
        <el-button type="primary" size="small" @click="goToLogin"
          >登录</el-button
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { ArrowDown, SwitchButton } from "@element-plus/icons-vue";
import { userManager } from "../utils/auth";
import defaultAvatar from "../assets/default-avatar.png";
import ThemeSwitcher from "./ThemeSwitcher.vue";

const router = useRouter();
const currentTime = ref("");
const currentWeekday = ref("");
const currentDateOnly = ref("");
let timer: ReturnType<typeof setInterval> | null = null;

// 获取用户信息和登录状态
const userInfo = computed(() => userManager.getUserInfo());
const displayName = computed(() => userInfo.value?.nickname?.trim() || userInfo.value?.id || '未登录');
const isLoggedIn = computed(() => userManager.isLoggedIn());

const updateClock = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  currentTime.value = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
    now.getSeconds()
  )}`;

  currentWeekday.value = new Intl.DateTimeFormat("zh-CN", {
    weekday: "long",
  }).format(now);
  currentDateOnly.value = `${now.getFullYear()}-${pad(
    now.getMonth() + 1
  )}-${pad(now.getDate())}`;
};

// 处理下拉菜单命令
const handleCommand = async (command: string) => {
  if (command === "logout") {
    try {
      await ElMessageBox.confirm(
        "确定要退出登录吗？",
        "退出登录",
        {
          confirmButtonText: "确定",
          cancelButtonText: "取消",
          type: "warning",
        }
      );
    } catch {
      // 用户取消退出时无需处理。
      return;
    }

    try {
      // 执行退出
      await userManager.logout();
      ElMessage.success("已退出登录");

      // 跳转到登录页
      router.push("/login");
    } catch {
      ElMessage.error("登出失败，请稍后重试");
    }
  }
};

// 跳转到登录页
const goToLogin = () => {
  router.push("/login");
};

onMounted(() => {
  updateClock();
  timer = setInterval(updateClock, 1000);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
});
</script>

<style scoped>
.topbar {
  box-sizing: border-box;
  height: 70px;
  background: #ffffff;
  border-radius: 16px;
  padding: 0 24px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  box-shadow: 0 4px 12px rgba(9, 30, 66, 0.08);
  border: 1px solid var(--app-border);
  gap: 16px;
}

.top-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
}

.time-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 36px;
}

.time {
  font-size: 24px;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--app-accent);
  letter-spacing: 0.4px;
}

.date-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 3px;
}

.weekday {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  color: #718097;
}

.date-line {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  color: #718097;
}

.user-info {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  gap: 8px;
  cursor: pointer;
  padding: 0 10px;
  border: 1px solid #edf0f4;
  border-radius: 8px;
  background: #f8f9fb;
  font-family: inherit;
  transition: background-color 150ms, border-color 150ms;
}

.user-info:hover {
  background: #f0f3f7;
  border-color: #dfe5ed;
}

.user-info:focus-visible {
  outline: 2px solid var(--app-accent);
  outline-offset: 3px;
}

.user-chevron {
  flex-shrink: 0;
  color: #8c95a4;
  font-size: 11px;
}

.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #e3f2fd;
  display: block;
  object-fit: cover;
  flex-shrink: 0;
}

.username {
  display: inline-block;
  line-height: 20px;
  font-size: 13px;
  font-weight: 500;
  color: #292929;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-details {
  padding: 8px;
  min-width: 200px;
}

.user-details div {
  margin: 6px 0;
  font-size: 13px;
  color: #606266;
}

.user-details strong {
  color: #303133;
}

.login-prompt {
  display: flex;
  align-items: center;
}

:deep(.el-dropdown-menu__item) {
  padding: 10px 16px;
}

:deep(.el-dropdown-menu__item:not(.is-disabled):hover) {
  background-color: #f5f7fa;
  color: var(--app-accent);
}

@media (max-width: 1280px) {
  .topbar { padding: 0 16px; }
  .top-right { gap: 12px; }
  .time { font-size: 22px; }
  .date-col { display: none; }
}

@media (max-width: 960px) {
  .time-wrap { display: none; }
  .username { max-width: 64px; }
}

@media (prefers-reduced-motion: reduce) {
  .user-info { transition: none; }
}
</style> 
