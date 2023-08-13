// .eslintrc.js
process.env.ESLINT_TSCONFIG = 'tsconfig.json'
module.exports = {
  extends: ['@antfu', 'plugin:storybook/recommended'],
  rules: {
    'no-void': 'off',
  },
}
