import { ESLintUtils } from '@typescript-eslint/utils'

export const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/oosawy/throwspec/blob/main/eslint/docs/rules/${name}.md`,
)
