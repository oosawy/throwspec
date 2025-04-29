import { RuleCreator } from '@typescript-eslint/utils/eslint-utils'
export { ESLintUtils } from '@typescript-eslint/utils'

type MessageIds = 'issue:missing-throws-comment' | 'fix:mark-throws'

type Options = []

export const createRule = RuleCreator(
  (name) => `https://my-website.io/eslint/${name}`
)

export const ruleThrowsComment = createRule<Options, MessageIds>({
  name: 'throws-comment',
  meta: {
    docs: {
      description: 'An example ESLint rule',
    },
    hasSuggestions: true,
    messages: {
      'issue:missing-throws-comment': 'Missing /*throws*/ comment.',
      'fix:mark-throws': '',
    },
    schema: [],
    type: 'suggestion',
  },
  defaultOptions: [],
  create: (context, options) => {
    return {}
  },
})
