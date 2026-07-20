import { UiLocaleProvider } from './i18n/UiLocaleContext.jsx';
import ArchiSlop from './ArchiSlop.jsx';

function App() {
  return (
    <UiLocaleProvider>
      <ArchiSlop />
    </UiLocaleProvider>
  );
}

export default App;
