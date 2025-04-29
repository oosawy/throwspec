import path from 'node:path'
import tseslint from 'typescript-eslint'
import { RuleTester } from '@typescript-eslint/rule-tester'

import { rule } from './throws-annotation'

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      projectService: {
        allowDefaultProject: ['*.ts*'],
        defaultProject: 'tsconfig.json',
      },
      tsconfigRootDir: path.join(__dirname, '../..'),
    },
  },
})

ruleTester.run('throws-annotation', rule, {
  valid: [
    {
      code: `function fn(): Throws<Error> {}; throws<Error>(fn())`,
    },
  ],
  invalid: [
    {
      code: `function fn(): Throws<Error> {}; throws(fn())`,
      errors: [
        {
          messageId: 'issue:missing-throws-annotation',
          suggestions: [
            {
              messageId: 'fix:infer-throws-annotation',
              output: `function fn(): Throws<Error> {}; throws<Error>(fn())`,
            },
          ],
        },
      ],
    },
  ],
})
