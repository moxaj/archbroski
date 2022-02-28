import React from 'react';
import ReactDOM from 'react-dom';
import { window } from '@tauri-apps/api';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import Settings from './Settings';
import Overlay from './Overlay';
import Error from './Error';
import './index.scss';

export function numberKeys<T>(map: { [key: number]: T }) {
  return Object.keys(map).map(item => +item);
};

const windowLabel = window.getCurrent().label;
ReactDOM.render(
  <React.StrictMode>
    {
      windowLabel === 'overlay'
        ? (
          <Overlay />
        )
        : (
          <ThemeProvider theme={createTheme({
            palette: {
              mode: 'dark',
            },
          })}>
            <CssBaseline enableColorScheme />
            {
              windowLabel === 'settings' && (
                <Settings />
              )
            }
            {
              windowLabel === 'error' && (
                <Error />
              )
            }
          </ThemeProvider>
        )
    }
  </React.StrictMode>,
  document.getElementById('root')
);