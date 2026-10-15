import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

const rose = {
  50: '#fcf2f6',
  100: '#f9e3ec',
  200: '#f3c7d9',
  300: '#ef9dbd',
  400: '#e8679a',
  500: '#c43f73',
  600: '#a9325f',
  700: '#8b284e',
  800: '#6f2140',
  900: '#5a1d36',
  950: '#350c1d',
}

const graphite = {
  0: '#ffffff',
  50: '#f7f8f9',
  100: '#f2f3f5',
  200: '#e7e9ee',
  300: '#c9ccd3',
  400: '#9da2ad',
  500: '#7c818c',
  600: '#5e636e',
  700: '#40444d',
  800: '#25282f',
  900: '#1b1d23',
  950: '#121317',
}

const MitaPreset = definePreset(Aura, {
  primitive: {
    borderRadius: { none: '0', xs: '4px', sm: '8px', md: '10px', lg: '16px', xl: '20px' },
  },
  semantic: {
    primary: rose,
    formField: { paddingY: '0.625rem' },
    colorScheme: {
      light: {
        surface: graphite,
        primary: {
          color: '{primary.500}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.600}',
          activeColor: '{primary.700}',
        },
      },
      dark: {
        surface: graphite,
        primary: {
          color: '{primary.400}',
          contrastColor: '#16080f',
          hoverColor: '{primary.300}',
          activeColor: '{primary.200}',
        },
      },
    },
  },
  components: {
    button: { root: { iconOnlyWidth: '2.75rem' } },
    togglebutton: { content: { padding: '0.375rem 0.75rem' } },
  },
})

export default {
  preset: MitaPreset,
  options: {
    darkModeSelector: '.dark',
    cssLayer: { name: 'primevue', order: 'theme, base, primevue' },
  },
}
