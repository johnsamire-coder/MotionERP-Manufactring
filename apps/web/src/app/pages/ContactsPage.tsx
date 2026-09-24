import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';

type PartyType = 'customer' | 'supplier' | 'lead';
interface PartyOption {
  id: string;
  label: string;
}
interface PartyLink {
  id: string;
  partyType: PartyType;
  partyId: string;
  isPrimary: boolean;
}
interface ContactRecord {
  id: string;
  firstName: string;
  lastName: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  status: string;
  links: PartyLink[];
}
interface AddressRecord {
  id: string;
  title: string;
  addressType: string;
  line1: string;
  line2: string | null;
  city: string;
  governorate: string | null;
  country: string;
  links: PartyLink[];
}
interface PartyDetails {
  contacts: ContactRecord[];
  addresses: AddressRecord[];
  primaryContactId: string | null;
  primaryAddressId: string | null;
}

const PARTY_LABEL: Record<PartyType, string> = {
  customer: 'عميل',
  supplier: 'مورد',
  lead: 'عميل محتمل',
};
const ADDRESS_TYPE_LABEL: Record<string, string> = {
  billing: 'فواتير',
  shipping: 'شحن',
  office: 'مكتب',
  warehouse: 'مخزن',
  site: 'موقع',
  other: 'أخرى',
};
const message = (err: unknown, fallback: string): string =>
  err instanceof ApiError ? err.message : fallback;

const input = 'mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm';
const label = 'block text-xs font-bold text-slate-600';

/**
 * جهات الاتصال والعناوين (بند 26): الشخص أو العنوان سجل مستقل، ويتربط بأي عدد من
 * العملاء/الموردين/العملاء المحتملين. لكل طرف جهة اتصال أساسية واحدة وعنوان أساسي واحد.
 */
export function ContactsPage(): JSX.Element {
  const [partyType, setPartyType] = useState<PartyType>('customer');
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [partyId, setPartyId] = useState('');
  const [details, setDetails] = useState<PartyDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [contactPrimary, setContactPrimary] = useState(true);

  const [title, setTitle] = useState('');
  const [addressType, setAddressType] = useState('billing');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [addressPrimary, setAddressPrimary] = useState(true);

  useEffect(() => {
    void (async (): Promise<void> => {
      setPartyId('');
      setDetails(null);
      try {
        const options: PartyOption[] =
          partyType === 'customer'
            ? (
                await api.get<{ customers: Array<{ id: string; code: string; name: string }> }>(
                  '/crm/customers',
                )
              ).customers.map((c) => ({ id: c.id, label: `${c.code} — ${c.name}` }))
            : partyType === 'supplier'
              ? (
                  await api.get<{ suppliers: Array<{ id: string; code: string; name: string }> }>(
                    '/crm/suppliers',
                  )
                ).suppliers.map((s) => ({ id: s.id, label: `${s.code} — ${s.name}` }))
              : (
                  await api.get<{
                    leads: Array<{ id: string; leadNumber: string; personName: string }>;
                  }>('/crm/leads')
                ).leads.map((l) => ({ id: l.id, label: `${l.leadNumber} — ${l.personName}` }));
        setParties(options);
        if (options[0]) setPartyId(options[0].id);
      } catch (err) {
        setError(message(err, 'فشل تحميل الأطراف'));
      }
    })();
  }, [partyType]);

  async function load(): Promise<void> {
    if (!partyId) return;
    try {
      setDetails(
        await api.get<PartyDetails>(`/crm/parties/${partyType}/${partyId}/contact-details`),
      );
    } catch (err) {
      setError(message(err, 'فشل تحميل جهات الاتصال'));
    }
  }

  useEffect(() => {
    void load();
  }, [partyId]);

  async function run(action: () => Promise<unknown>, fallback: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(message(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  const addContact = (): Promise<void> =>
    run(async () => {
      await api.post('/crm/contacts', {
        firstName,
        lastName: lastName || undefined,
        designation: designation || undefined,
        email: email || undefined,
        mobile: mobile || undefined,
        links: [{ partyType, partyId, isPrimary: contactPrimary }],
      });
      setFirstName('');
      setLastName('');
      setDesignation('');
      setEmail('');
      setMobile('');
    }, 'فشل إضافة جهة الاتصال');

  const addAddress = (): Promise<void> =>
    run(async () => {
      await api.post('/crm/addresses', {
        title,
        addressType,
        line1,
        city,
        governorate: governorate || undefined,
        links: [{ partyType, partyId, isPrimary: addressPrimary }],
      });
      setTitle('');
      setLine1('');
      setCity('');
      setGovernorate('');
    }, 'فشل إضافة العنوان');

  const makePrimary = (kind: 'contacts' | 'addresses', id: string): Promise<void> =>
    run(
      () => api.post(`/crm/${kind}/${id}/links`, { partyType, partyId, isPrimary: true }),
      'فشل تعيين الأساسي',
    );

  const unlink = (kind: 'contacts' | 'addresses', owner: { id: string; links: PartyLink[] }) => {
    const link = owner.links.find((l) => l.partyType === partyType && l.partyId === partyId);
    if (!link) return Promise.resolve();
    return run(() => api.delete(`/crm/${kind}/${owner.id}/links/${link.id}`), 'فشل فك الربط');
  };

  const otherLinks = (links: PartyLink[]): string =>
    links
      .filter((l) => !(l.partyType === partyType && l.partyId === partyId))
      .map((l) => PARTY_LABEL[l.partyType])
      .join('، ');

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">جهات الاتصال والعناوين</h1>
        <p className="text-sm text-slate-500 mt-1">
          الشخص أو العنوان بيتسجل مرة واحدة ويتربط بكذا عميل أو مورد. لكل طرف جهة اتصال أساسية واحدة
          وعنوان أساسي واحد.
        </p>
      </div>

      {error && (
        <div className="text-sm bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-3">
          {error}
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-3">
        <label className={label}>
          نوع الطرف
          <select
            className={input}
            value={partyType}
            onChange={(e) => setPartyType(e.target.value as PartyType)}
          >
            <option value="customer">عميل</option>
            <option value="supplier">مورد</option>
            <option value="lead">عميل محتمل</option>
          </select>
        </label>
        <label className={`${label} flex-1`}>
          الطرف
          <select className={input} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            {parties.length === 0 && <option value="">— مفيش —</option>}
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {details && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-lg font-bold">جهات الاتصال ({details.contacts.length})</h2>
            {details.contacts.map((c) => (
              <div key={c.id} className="border border-slate-200 rounded-xl p-3 text-sm">
                <div className="flex justify-between items-center gap-2">
                  <b>
                    {c.firstName} {c.lastName ?? ''}
                    {c.designation ? ` — ${c.designation}` : ''}
                  </b>
                  {c.id === details.primaryContactId ? (
                    <span className="text-xs bg-teal-100 text-teal-800 rounded-full px-2 py-0.5">
                      أساسية
                    </span>
                  ) : (
                    <button
                      className="text-xs text-teal-700 underline cursor-pointer"
                      disabled={busy}
                      onClick={() => void makePrimary('contacts', c.id)}
                    >
                      اجعلها الأساسية
                    </button>
                  )}
                </div>
                <div className="text-slate-500 mt-1">
                  {[c.email, c.mobile, c.phone].filter(Boolean).join(' · ') || '—'}
                </div>
                <div className="flex justify-between mt-1 text-xs text-slate-400">
                  <span>{otherLinks(c.links) && `مربوطة كمان بـ: ${otherLinks(c.links)}`}</span>
                  <button
                    className="text-rose-600 underline cursor-pointer"
                    disabled={busy}
                    onClick={() => void unlink('contacts', c)}
                  >
                    فك الربط
                  </button>
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <label className={label}>
                الاسم الأول
                <input
                  className={input}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </label>
              <label className={label}>
                اسم العائلة
                <input
                  className={input}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
              <label className={label}>
                الوظيفة
                <input
                  className={input}
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                />
              </label>
              <label className={label}>
                الموبايل
                <input
                  className={input}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                />
              </label>
              <label className={`${label} col-span-2`}>
                البريد الإلكتروني
                <input className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={contactPrimary}
                  onChange={(e) => setContactPrimary(e.target.checked)}
                />
                أساسية
              </label>
              <button
                onClick={() => void addContact()}
                disabled={busy || !partyId || !firstName.trim()}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold cursor-pointer"
              >
                إضافة جهة اتصال
              </button>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-lg font-bold">العناوين ({details.addresses.length})</h2>
            {details.addresses.map((a) => (
              <div key={a.id} className="border border-slate-200 rounded-xl p-3 text-sm">
                <div className="flex justify-between items-center gap-2">
                  <b>
                    {a.title} ({ADDRESS_TYPE_LABEL[a.addressType] ?? a.addressType})
                  </b>
                  {a.id === details.primaryAddressId ? (
                    <span className="text-xs bg-teal-100 text-teal-800 rounded-full px-2 py-0.5">
                      أساسي
                    </span>
                  ) : (
                    <button
                      className="text-xs text-teal-700 underline cursor-pointer"
                      disabled={busy}
                      onClick={() => void makePrimary('addresses', a.id)}
                    >
                      اجعله الأساسي
                    </button>
                  )}
                </div>
                <div className="text-slate-500 mt-1">
                  {[a.line1, a.line2, a.city, a.governorate, a.country].filter(Boolean).join('، ')}
                </div>
                <div className="flex justify-end mt-1 text-xs">
                  <button
                    className="text-rose-600 underline cursor-pointer"
                    disabled={busy}
                    onClick={() => void unlink('addresses', a)}
                  >
                    فك الربط
                  </button>
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <label className={label}>
                اسم العنوان
                <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className={label}>
                النوع
                <select
                  className={input}
                  value={addressType}
                  onChange={(e) => setAddressType(e.target.value)}
                >
                  {Object.entries(ADDRESS_TYPE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${label} col-span-2`}>
                العنوان
                <input className={input} value={line1} onChange={(e) => setLine1(e.target.value)} />
              </label>
              <label className={label}>
                المدينة
                <input className={input} value={city} onChange={(e) => setCity(e.target.value)} />
              </label>
              <label className={label}>
                المحافظة
                <input
                  className={input}
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={addressPrimary}
                  onChange={(e) => setAddressPrimary(e.target.checked)}
                />
                أساسي
              </label>
              <button
                onClick={() => void addAddress()}
                disabled={busy || !partyId || !title.trim() || !line1.trim() || !city.trim()}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold cursor-pointer"
              >
                إضافة عنوان
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContactsPage;
