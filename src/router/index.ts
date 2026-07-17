import type { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: "/login",
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("../views/Login.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/register",
    name: "Register",
    component: () => import("../views/Register.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/forgot-password",
    name: "ForgotPassword",
    component: () => import("../views/ForgotPassword.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/maxcut",
    name: "MaxCut",
    component: () => import("../views/MaxCut.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/number",
    name: "Number",
    component: () => import("../views/Number.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/coloring",
    name: "Coloring",
    component: () => import("../views/Coloring.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/tsp",
    name: "TSP",
    component: () => import("../views/TSP.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/tasks",
    name: "Tasks",
    component: () => import("../views/Tasks.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/feedback",
    name: "Feedback",
    component: () => import("../views/Feedback.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/feedback/history",
    name: "FeedbackHistory",
    component: () => import("../views/FeedbackHistory.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/login",
  },
];

export default routes;
