import { Badge, Button, Card, Paper, createTheme, type MantineColorsTuple } from '@mantine/core';

// «Чертёжный» синий — основной цвет интерфейса
const blueprint: MantineColorsTuple = [
  '#eaf1fb',
  '#d3e1f5',
  '#a8c2ea',
  '#7aa1de',
  '#5486d4',
  '#3b74cc',
  '#1f5fad',
  '#1a5096',
  '#14427e',
  '#0e3465',
];

export const theme = createTheme({
  primaryColor: 'blueprint',
  colors: { blueprint },
  fontFamily: '"Golos Text", system-ui, -apple-system, "Segoe UI", sans-serif',
  headings: {
    fontFamily: '"Golos Text", system-ui, sans-serif',
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '1.875rem', lineHeight: '1.2' },
      h2: { fontSize: '1.5rem', lineHeight: '1.25' },
      h3: { fontSize: '1.25rem', lineHeight: '1.3' },
      h4: { fontSize: '1.0625rem', lineHeight: '1.35' },
    },
  },
  defaultRadius: 'sm',
  black: '#1f2933',
  components: {
    Badge: Badge.extend({
      defaultProps: { radius: 'sm', size: 'md' },
      styles: { root: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 } },
    }),
    Button: Button.extend({
      defaultProps: { radius: 'sm' },
      styles: { root: { fontWeight: 600 } },
    }),
    Card: Card.extend({ defaultProps: { radius: 'md', withBorder: true, padding: 'lg' } }),
    Paper: Paper.extend({ defaultProps: { radius: 'md' } }),
  },
});
