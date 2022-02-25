import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { window } from '@tauri-apps/api';
import React from 'react';
import ReactDOM from 'react-dom';
import Error from './Error';
import Overlay from './Overlay';
import Settings from './Settings';
import './index.scss';

const theme = createTheme({
  palette: {
    mode: 'dark',
  },
});
const windowLabel = window.getCurrent().label;
ReactDOM.render(
  <React.StrictMode>
    {
      windowLabel === 'overlay'
        ? (
          <Overlay />
        )
        : (
          <ThemeProvider theme={theme}>
            <CssBaseline />
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