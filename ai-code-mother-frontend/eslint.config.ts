/**
 * ESLint Flat Config：为 Vue 单文件组件与 TypeScript 源码组合规则。
 * Oxlint 与 ESLint 的规则在这里衔接，最后关闭与 Prettier 冲突的纯格式规则。
 * package.json 的 lint 脚本带有自动修复；只读检查应直接调用 eslint 而不添加修复参数。
 */
import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    // 仅匹配支持的源码后缀，不把图片或编译产物当成源码解析。
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  // 编译产物与覆盖率报告交给各自生成器维护，不参与手写源码规则检查。
  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  // Vue essential 规则先检查模板基本正确性，再叠加项目使用的 TypeScript 推荐规则。
  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  // 读取 Oxlint 的现有配置，使两套检查工具的规则职责保持协调。
  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  // 最后处理格式规则冲突，不负责改动业务逻辑或替代类型检查。
  skipFormatting,
)
