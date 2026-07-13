import { ref } from "vue";

const customTaskName = ref("");

const trimName = (value = ""): string => value.trim();

const setCustomTaskName = (value = ""): string => {
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
