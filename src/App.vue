<template>
  <div id="app">
    <el-container>
      <!-- 侧边栏 -->
      <el-aside width="240px">
        <Sidebar />
      </el-aside>
      
      <!-- 主内容区 -->
      <el-container>
        <!-- 顶栏 -->
        <el-header height="70px">
          <TopBar />
        </el-header>
        
        <!-- 主内容 -->
        <el-main>
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import Sidebar from './components/Sidebar.vue'
import TopBar from './components/TopBar.vue'
</script>

<style>
#app {
  height: 100vh;
  font-family: "PingFang SC", "Noto Sans SC", "Inter", "Roboto", sans-serif;
}

.el-container {
  height: 100vh;
  background: linear-gradient(180deg, #F6F7FA, #FBFBFF);
  padding: 20px;
  gap: 20px;
}

.el-aside {
  background: linear-gradient(180deg, #F6F7FF, #FFFFFF);
  border-radius: 18px;
  border: 1px solid #E6EAF5;
  box-shadow: 0 10px 20px rgba(9, 30, 66, 0.04);
  padding: 18px;
}

.el-header {
  padding: 0;
  margin-bottom: 20px;
}

.el-main {
  padding: 0;
}
</style> 