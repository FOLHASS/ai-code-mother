<script setup lang="ts">
defineProps<{
  codeGenType?: string
  hasApp: boolean
  hasGeneratedWebsite: boolean
  previewUrl: string
  previewError: string
  isStreaming: boolean
}>()

const emit = defineEmits<{ refresh: [] }>()
</script>

<template>
  <section class="preview-panel">
    <div class="preview-heading">
      <div>
        <p>LIVE PREVIEW</p>
        <h2>生成后的网站展示</h2>
      </div>
      <span v-if="hasGeneratedWebsite" class="preview-status"><i></i> 网站预览</span>
    </div>
    <div class="browser-frame">
      <div class="browser-toolbar">
        <span class="browser-dots"><i></i><i></i><i></i></span>
        <div class="browser-address">localhost / {{ codeGenType || 'preview' }}</div>
        <button
          :disabled="isStreaming || !hasApp"
          aria-label="刷新网站预览"
          class="browser-refresh"
          type="button"
          @click="emit('refresh')"
        >
          ↻
        </button>
      </div>
      <div class="browser-content">
        <iframe
          v-if="hasGeneratedWebsite && previewUrl"
          :src="previewUrl"
          sandbox="allow-forms allow-modals allow-popups allow-scripts allow-same-origin"
          title="生成的网站预览"
        ></iframe>
        <div v-else class="preview-empty">
          <span class="preview-loader"><i></i><i></i><i></i></span
          ><strong>{{
            previewError
              ? '网站预览暂不可用'
              : isStreaming
                ? '正在解析生成的网站'
                : '网站预览会出现在这里'
          }}</strong>
          <p>
            {{
              previewError ||
              (isStreaming
                ? '代码流式输出完成后，预览会自动加载'
                : '等待左侧 AI 完成代码生成后自动展示')
            }}
          </p>
        </div>
      </div>
    </div>
    <div class="preview-footnote">
      <span>⌘</span>
      <p>生成完成后会自动刷新预览，你可以继续对话优化页面。</p>
    </div>
  </section>
</template>

<style scoped>
.preview-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px 17px;
  border-bottom: 1px solid #edf2f4;
}

.preview-heading p {
  margin: 0 0 5px;
  color: #3ea18e;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.14em;
}

.preview-heading h2 {
  margin: 0;
  color: #1c344a;
  font-size: 18px;
  font-weight: 650;
}

.preview-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 9px;
  color: #328675;
  font-size: 11px;
  background: #f0faf7;
  border-radius: 999px;
  white-space: nowrap;
}

.preview-status i {
  width: 6px;
  height: 6px;
  background: #29b78a;
  border-radius: 50%;
}

.preview-panel {
  padding-bottom: 18px;
}
.browser-frame {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 350px;
  margin: 20px;
  overflow: hidden;
  background: #f6f8f9;
  border: 1px solid #e0e8eb;
  border-radius: 10px;
}
.browser-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 38px;
  padding: 0 13px;
  background: #edf3f4;
  border-bottom: 1px solid #dde7e9;
}
.browser-dots {
  display: flex;
  gap: 5px;
}
.browser-dots i {
  width: 7px;
  height: 7px;
  background: #c1d0d2;
  border-radius: 50%;
}
.browser-dots i:first-child {
  background: #f0a19b;
}
.browser-dots i:nth-child(2) {
  background: #e9cf8e;
}
.browser-dots i:last-child {
  background: #94d1b7;
}
.browser-address {
  flex: 1;
  padding: 5px 10px;
  overflow: hidden;
  color: #99a7ad;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #f9fbfb;
  border-radius: 5px;
}
.browser-refresh {
  color: #91a1a7;
  font-size: 16px;
  padding: 0;
  background: transparent;
  border: 0;
  cursor: pointer;
}
.browser-refresh:disabled {
  cursor: not-allowed;
}
.browser-content {
  position: relative;
  flex: 1;
  min-height: 0;
  background: #fff;
}
.browser-content iframe {
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
}
.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 240px;
  color: #9baab0;
  text-align: center;
}
.preview-empty strong {
  color: #506974;
  font-size: 14px;
}
.preview-empty p {
  margin: 7px 0 0;
  font-size: 12px;
}
.preview-loader {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 56px;
  height: 56px;
  margin-bottom: 15px;
  background: #edf9f5;
  border-radius: 17px;
}
.preview-loader i {
  width: 7px;
  height: 7px;
  background: #54ad9e;
  border-radius: 50%;
  animation: preview-pulse 1s ease-in-out infinite;
}
.preview-loader i:nth-child(2) {
  animation-delay: 0.15s;
}
.preview-loader i:nth-child(3) {
  animation-delay: 0.3s;
}
.preview-footnote {
  display: flex;
  gap: 9px;
  margin: 0 20px;
  color: #9ba9af;
  font-size: 11px;
}
.preview-footnote span {
  color: #54ad9e;
}
.preview-footnote p {
  margin: 0;
}
@keyframes preview-pulse {
  0%,
  100% {
    transform: translateY(3px);
    opacity: 0.4;
  }
  50% {
    transform: translateY(-3px);
    opacity: 1;
  }
}
@media (max-width: 560px) {
  .preview-heading {
    padding: 17px 16px 14px;
  }
  .preview-heading {
    padding: 17px 16px 14px;
  }
  .browser-frame {
    margin: 12px;
  }
  .preview-footnote {
    margin: 0 12px;
  }
}
</style>
