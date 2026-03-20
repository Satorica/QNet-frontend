<template>
  <div class="topbar">
    <div class="top-left">
      <div class="task-input">
        <el-input
          v-model="taskName"
          :placeholder="$t('topbar.taskInput')"
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

      <!-- 用户信息和菜单 -->
      <el-dropdown v-if="isLoggedIn" @command="handleCommand" trigger="click">
        <div class="user-info">
          <div class="avatar">
            {{ userInfo?.username?.charAt(0).toUpperCase() || "U" }}
          </div>
          <span class="username">{{
            userInfo?.username || $t("topbar.userInfo.notLoggedIn")
          }}</span>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item disabled>
              <div class="user-details">
                <div>
                  <strong>{{ $t("topbar.userInfo.username") }}:</strong>
                  {{ userInfo?.username }}
                </div>
                <div v-if="userInfo?.email">
                  <strong>{{ $t("topbar.userInfo.email") }}:</strong>
                  {{ userInfo?.email }}
                </div>
                <div v-if="userInfo?.phone">
                  <strong>{{ $t("topbar.userInfo.phone") }}:</strong>
                  {{ userInfo?.phone }}
                </div>
              </div>
            </el-dropdown-item>
            <el-dropdown-item divided command="logout">
              <el-icon><SwitchButton /></el-icon>
              <span>{{ $t("topbar.logout") }}</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- 未登录时显示 -->
      <div v-else class="login-prompt">
        <el-button type="primary" size="small" @click="goToLogin">{{
          $t("topbar.login")
        }}</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { SwitchButton } from "@element-plus/icons-vue";
import { useI18n } from "vue-i18n";
import { userManager } from "../utils/auth.js";
import { checkTaskName } from "../api/index.js";

const router = useRouter();
const { t } = useI18n();
const taskName = ref("");
const currentTime = ref("");
const currentDate = ref("");
let timer = null;

// 获取用户信息和登录状态
const userInfo = computed(() => userManager.getUserInfo());
const isLoggedIn = computed(() => userManager.isLoggedIn());

const updateClock = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  currentTime.value = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
    now.getSeconds()
  )}`;

  const days = t("topbar.weekdays", { returnObjects: true });
  currentDate.value = `${days[now.getDay()]} ${now.getFullYear()}-${pad(
    now.getMonth() + 1
  )}-${pad(now.getDate())}`;
};

const handleOk = async () => {
  const name = taskName.value.trim();

  if (!name) {
    ElMessage.warning("请输入任务名称");
    return;
  }

  try {
    await checkTaskName(name);
    ElMessage.success("任务名称可用");

    // 这里保存“当前待使用的自定义名称”
    // 比如 customTaskName.value = name
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.message || "检查任务名称失败";

    if (status === 400) {
      ElMessage.error(message); // 任务名称已存在 / 名称为空
      return;
    }

    if (status === 401) {
      ElMessage.error("请先登录");
      return;
    }

    ElMessage.error(message);
  }
};

// 处理下拉菜单命令
const handleCommand = async (command) => {
  if (command === "logout") {
    try {
      await ElMessageBox.confirm(
        t("topbar.confirmLogout"),
        t("topbar.logout"),
        {
          confirmButtonText: t("common.confirm"),
          cancelButtonText: t("common.cancel"),
          type: "warning",
        }
      );

      // 执行退出
      await userManager.logout();
      ElMessage.success(t("topbar.messages.logoutSuccess"));

      // 跳转到登录页
      router.push("/login");
    } catch (error) {
      if (error !== "cancel") {
        console.error("Logout error:", error);
      }
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
  }
});
</script>

<style scoped>
.topbar {
  height: 70px;
  background: #ffffff;
  border-radius: 16px;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 12px rgba(9, 30, 66, 0.08);
  border: 1px solid #e6eaf5;
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
  color: #8c8fa3;
  margin-top: 2px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 20px;
  transition: all 0.3s ease;
}

.user-info:hover {
  background: #f5f7fa;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4050f8, #7848e8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
}

.username {
  font-size: 14px;
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
  margin-left: 10px;
}

:deep(.el-dropdown-menu__item) {
  padding: 10px 16px;
}

:deep(.el-dropdown-menu__item:not(.is-disabled):hover) {
  background-color: #f5f7fa;
  color: #4050f8;
}
</style> 