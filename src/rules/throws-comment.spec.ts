import { RuleTester } from '@typescript-eslint/rule-tester'

import { ruleThrowsComment } from './throws-comment'

const ruleTester = new RuleTester({
  parser: '@typescript-eslint/parser',
})

ruleTester.run('eslint-plugin/throws-comment', ruleThrowsComment, {
  valid: [
    {
      code: `throws/*Error*/(fn)`,
    },
    {
      code: `throws /* Error */ (fn)`,
    },
  ],
  invalid: [
    {
      code: `throws(fn)`,
      errors: [
        {
          messageId: 'issue:missing-throws-comment',
          suggestions: [
            {
              messageId: 'fix:mark-throws',
              output: `throws/*Error*/(fn)`,
            },
          ],
        },
      ],
    },
  ],
})
