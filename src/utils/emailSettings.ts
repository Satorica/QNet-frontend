import { ref } from 'vue';

export const emailSettingsVisible = ref(false);
export const emailSettingsReason = ref('');

export function openEmailSettings(reason = '') {
  emailSettingsReason.value = reason;
  emailSettingsVisible.value = true;
}
