import { Theme } from '../types'

export const bw: Theme = {
  name: 'bw',
  font: {
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"SF Mono", "Fira Code", Consolas, monospace',
  },
  radius: '4px',
  colors: {
    pageBg: '#ffffff',
    surfaceBg: '#f5f5f5',
    cardBg: '#ffffff',
    border: '#cccccc',
    borderSubtle: '#e8e8e8',
    text: '#000000',
    textMuted: '#555555',
    textSubtle: '#999999',
    primary:   { bg: '#000000', text: '#ffffff', border: '#000000' },
    secondary: { bg: '#ffffff', text: '#000000', border: '#000000' },
    ghost:     { bg: 'transparent', text: '#000000', border: 'transparent' },
    danger:    { bg: '#ffffff', text: '#cc0000', border: '#cc0000' },
    info:    { bg: '#e8edf5', text: '#1a3a6e' },
    success: { bg: '#e8f5eb', text: '#1a5c2a' },
    warning: { bg: '#fdf5e0', text: '#7a5200' },
  },
}

export const flexoki: Theme = {
  name: 'flexoki',
  font: {
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"SF Mono", "Fira Code", Consolas, monospace',
  },
  radius: '4px',
  colors: {
    pageBg:      '#FFFCF0',  // paper
    surfaceBg:   '#F2F0E5',  // base-50
    cardBg:      '#FFFCF0',  // paper
    border:      '#CECDC3',  // base-200
    borderSubtle:'#E6E4D9',  // base-100
    text:        '#100F0F',  // black
    textMuted:   '#878580',  // base-500
    textSubtle:  '#B7B5AC',  // base-300
    primary:   { bg: '#205EA6', text: '#FFFCF0', border: '#205EA6' },  // blue-600
    secondary: { bg: '#FFFCF0', text: '#100F0F', border: '#CECDC3' },
    ghost:     { bg: 'transparent', text: '#100F0F', border: 'transparent' },
    danger:    { bg: '#FFFCF0', text: '#AF3029', border: '#AF3029' },   // red-600
    info:    { bg: '#D4E4F4', text: '#205EA6' },
    success: { bg: '#DDE7C2', text: '#66800B' },
    warning: { bg: '#F7EBC2', text: '#AD8301' },
  },
}

export const themes: Record<string, Theme> = { bw, flexoki }

export function getTheme(name: string | undefined): Theme {
  return themes[name ?? 'bw'] ?? bw
}
