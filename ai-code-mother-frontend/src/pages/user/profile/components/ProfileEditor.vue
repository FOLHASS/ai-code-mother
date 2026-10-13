<script setup lang="ts">
import { useProfileEditor } from '../composables/useProfileEditor.ts'

const { profileForm, isSaving, resetForm, handleSave } = useProfileEditor()
</script>

<template>
  <section class="profile-form-panel" aria-label="编辑个人信息">
    <div class="section-heading">
      <div>
        <h2>资料设置</h2>
        <p>以下信息会展示在你的平台资料中。</p>
      </div>
      <span class="edit-mark">EDIT PROFILE</span>
    </div>

    <form class="profile-form" @submit.prevent="handleSave">
      <label class="field-item">
        <span>用户昵称</span>
        <input
          v-model="profileForm.userName"
          type="text"
          placeholder="请输入用户昵称"
          :disabled="isSaving"
        />
      </label>
      <label class="field-item">
        <span>头像地址</span>
        <input
          v-model="profileForm.userAvatar"
          type="url"
          placeholder="请输入头像图片 URL"
          :disabled="isSaving"
        />
      </label>
      <label class="field-item">
        <span>个人简介</span>
        <textarea
          v-model="profileForm.userProfile"
          rows="6"
          placeholder="介绍一下你自己，最多 200 字"
          :disabled="isSaving"
        ></textarea>
      </label>

      <div class="form-footer">
        <button class="secondary-button" type="button" :disabled="isSaving" @click="resetForm">
          恢复原值
        </button>
        <button class="primary-button" type="submit" :disabled="isSaving">
          {{ isSaving ? '保存中...' : '保存修改' }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
h2,
p {
  margin-top: 0;
}

.profile-form-panel {
  background: #fff;
  border: 1px solid #e4edf6;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(42 92 145 / 5%);
}

.profile-form-panel {
  padding: 28px 32px;
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 22px;
  border-bottom: 1px solid #edf2f7;
}

.section-heading h2 {
  margin-bottom: 7px;
  color: #20334f;
  font-size: 20px;
}

.section-heading p {
  margin-bottom: 0;
  color: #8a99aa;
  font-size: 13px;
}

.edit-mark {
  color: #9aabba;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.profile-form {
  display: grid;
  max-width: 640px;
  gap: 20px;
  padding-top: 24px;
}

.field-item {
  display: block;
}

.field-item > span {
  display: block;
  margin-bottom: 8px;
  color: #52647b;
  font-size: 13px;
  font-weight: 600;
}

.field-item input,
.field-item textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 11px 12px;
  color: #24364c;
  font: inherit;
  background: #fbfdff;
  border: 1px solid #d8e4ef;
  border-radius: 6px;
  outline: none;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.field-item input {
  height: 42px;
}

.field-item textarea {
  resize: vertical;
}

.field-item input:focus,
.field-item textarea:focus {
  border-color: #4a91e8;
  box-shadow: 0 0 0 3px rgb(74 145 232 / 11%);
}

.field-item input:disabled,
.field-item textarea:disabled,
button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}

.primary-button,
.secondary-button {
  height: 40px;
  padding: 0 16px;
  font: inherit;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
}

.primary-button {
  color: #fff;
  background: #2679d9;
  border: 1px solid #2679d9;
}

.primary-button:hover:not(:disabled) {
  background: #1768c5;
}

.secondary-button {
  color: #52647b;
  background: #fff;
  border: 1px solid #d8e4ef;
}

.secondary-button:hover:not(:disabled) {
  color: #2679d9;
  border-color: #8bb8e9;
}

@media (max-width: 480px) {
  .section-heading {
    flex-direction: column;
  }

  .profile-form-panel {
    padding: 24px 20px;
  }

  .form-footer {
    justify-content: stretch;
  }

  .form-footer button {
    flex: 1;
  }
}
</style>
