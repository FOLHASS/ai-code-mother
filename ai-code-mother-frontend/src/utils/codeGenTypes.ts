/**
 * 生成类型的统一来源：枚举值与后端协议一致，显示名称和筛选选项由同一配置派生。
 * 新增生成模式时应同步补充枚举与配置，业务页面无需复制字符串或维护第二份名称映射。
 * 代码生成类型枚举
 */
export enum CodeGenTypeEnum {
  // 单个 HTML 文件模式，生成目录本身可作为静态浏览入口。
  HTML = 'html',
  // 原生 HTML/CSS/JavaScript 多文件模式，不依赖 Vue 工程构建流程。
  MULTI_FILE = 'multi_file',
  // Vue 工程模式，网站预览需读取 dist 目录中的构建产物。
  VUE_PROJECT = 'vue_project',
}

/**
 * 代码生成类型配置
 */
export const CODE_GEN_TYPE_CONFIG = {
  [CodeGenTypeEnum.HTML]: {
    label: '原生 HTML 模式',
    value: CodeGenTypeEnum.HTML,
  },
  [CodeGenTypeEnum.MULTI_FILE]: {
    label: '原生多文件模式',
    value: CodeGenTypeEnum.MULTI_FILE,
  },
  [CodeGenTypeEnum.VUE_PROJECT]: {
    label: 'Vue 项目模式',
    value: CodeGenTypeEnum.VUE_PROJECT,
  },
} as const

// 上面的 as const 保留字面量类型，使配置键、选项 value 与枚举保持对应。
/**
 * 代码生成类型选项（用于下拉选择）
 */
export const CODE_GEN_TYPE_OPTIONS = Object.values(CODE_GEN_TYPE_CONFIG).map((config) => ({
  label: config.label,
  value: config.value,
}))

/**
 * 格式化代码生成类型
 * @param type 代码生成类型
 * @returns 格式化后的类型描述
 */
export const formatCodeGenType = (type: string | undefined): string => {
  if (!type) return '未知类型'

  // 未知的新类型保留后端原值，避免前后端版本不同时把已有记录显示成空白。
  return isValidCodeGenType(type) ? CODE_GEN_TYPE_CONFIG[type].label : type
}

/**
 * 获取所有代码生成类型
 */
export const getAllCodeGenTypes = () => {
  // 字符串枚举只有名称到值的单向映射，因此 Object.values 不会混入数字枚举的反向键。
  return Object.values(CodeGenTypeEnum)
}

/**
 * 检查是否为有效的代码生成类型
 * @param type 待检查的类型
 */
export const isValidCodeGenType = (type: string): type is CodeGenTypeEnum => {
  // 返回类型谓词，在校验成功的分支中可以直接用 type 索引生成类型配置。
  return Object.values(CodeGenTypeEnum).includes(type as CodeGenTypeEnum)
}
