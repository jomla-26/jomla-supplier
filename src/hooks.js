import { useState, useEffect, useCallback, useRef } from "react";
import { api, session, setUnauthorizedHandler, ApiError } from "./api.js";

/**
 * إدارة جلسة الدخول لأي تطبيق من تطبيقات جملة.
 * accountType: employee | customer | supplier
 */
export function useSession(accountType) {
  const [actor, setActor] = useState(() => session.actor);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(Boolean(session.token));

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setActor(null);
      setProfile(null);
    });
  }, []);

  // تحميل بيانات الحساب والصلاحيات عند وجود توكن
  useEffect(() => {
    let cancelled = false;
    if (!session.token) { setLoading(false); return; }

    api.me()
      .then((data) => {
        if (cancelled) return;
        setActor(data.actor);
        setProfile(data);
      })
      .catch(() => {
        if (!cancelled) { session.clear(); setActor(null); }
      })
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, []);

  const requestOtp = useCallback(
    (phone) => api.requestOtp(accountType, phone),
    [accountType]
  );

  const verifyOtp = useCallback(async (phone, otp) => {
    const data = await api.verifyOtp(accountType, phone, otp);
    setActor(data.actor);
    const me = await api.me().catch(() => null);
    if (me) setProfile(me);
    return data.actor;
  }, [accountType]);

  const logout = useCallback(() => {
    api.logout();
    setActor(null);
    setProfile(null);
  }, []);

  const can = useCallback(
    (permission) => Boolean(profile?.permissions?.includes(permission)),
    [profile]
  );

  return { actor, profile, loading, requestOtp, verifyOtp, logout, can };
}

/**
 * جلب بيانات مع حالات التحميل والخطأ.
 * يُعاد التحميل تلقائيًا عند تغيّر أي عنصر في deps.
 */
export function useFetch(fetcher, deps = [], { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (skip) { setLoading(false); return; }

    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    setError(null);

    Promise.resolve(fetcherRef.current(controller.signal))
      .then((result) => !cancelled && setData(result))
      .catch((err) => {
        if (cancelled || err.name === "AbortError") return;
        setError(err instanceof ApiError ? err.message : "تعذّر تحميل البيانات");
      })
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, skip]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload, setData };
}

/**
 * تنفيذ إجراء (إنشاء/تعديل) مع حالة الإرسال ورسالة الخطأ.
 */
export function useAction(action) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (...args) => {
    setPending(true);
    setError(null);
    try {
      return await action(...args);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تنفيذ الإجراء");
      throw err;
    } finally {
      setPending(false);
    }
  }, [action]);

  return { run, pending, error, clearError: () => setError(null) };
}
