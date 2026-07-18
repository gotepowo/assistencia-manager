import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import moment from 'moment'
import 'moment/locale/pt-br'

moment.locale('pt-br')

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
