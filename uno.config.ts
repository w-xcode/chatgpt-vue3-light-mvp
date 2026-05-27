import {
  defineConfig,
  presetAttributify,
  presetWind3,
  toEscapedSelector,
  transformerDirectives
} from 'unocss'

import presetRemToPx from '@unocss/preset-rem-to-px'


export default defineConfig({
  presets: [
    presetWind3(),
    presetAttributify(),
    presetRemToPx({
      baseFontSize: 4
    })
  ],
  transformers: [
    transformerDirectives()
  ],
  theme: {
    breakpoints: {
      'xs': '475px',
      'sm': '640px',
      'md': '1024px',
      'lg': '1200px',
      'xl': '1440px',
      '2xl': '1920px'
    },
    colors: {
      primary: '#692ee6',
      success: '#52c41a',
      warning: '#fe7d18',
      danger: '#fa5555',
      info: '#909399',
      bgcolor: '#f2ecee',
      border: '#c2c2c2'
    }
  },
  rules: []
})
