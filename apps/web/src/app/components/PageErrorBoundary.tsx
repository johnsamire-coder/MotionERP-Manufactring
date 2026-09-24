import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Keeps one broken screen from blanking the whole app: the error is shown in the page area and the
 * menu stays usable. Keyed by the current tab in App, so moving to another screen resets it.
 */
export class PageErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('screen crashed:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="p-6" dir="rtl">
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-5 space-y-2">
          <h2 className="text-lg font-bold">الشاشة دي حصل فيها خطأ</h2>
          <p className="text-sm">
            باقي البرنامج شغال عادي — اختار شاشة تانية من القائمة. تفاصيل الخطأ:
          </p>
          <code className="block text-xs bg-white/70 rounded p-2" dir="ltr">
            {this.state.error.message}
          </code>
        </div>
      </div>
    );
  }
}
