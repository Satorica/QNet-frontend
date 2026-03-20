import { ref } from "vue";

const customTaskName = ref("");

const trimName = (value = "") => value.trim();

const setCustomTaskName = (value = "") => {
  const trimmed = trimName(value);
  customTaskName.value = trimmed;
  return trimmed;
};

const clearCustomTaskName = () => {
  customTaskName.value = "";
};

export const useCustomTaskName = () => ({
  customTaskName,
  setCustomTaskName,
  clearCustomTaskName,
});
