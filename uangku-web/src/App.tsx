import { useState, useMemo, useEffect } from 'react';
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Trash2,
  PlusCircle,
  Lock,
  LogOut,
  Mail,
  User,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { type Transaction, type TransactionType } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/transactions';
const AUTH_URL = API_URL.replace('/transactions', '/auth');
const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6'];

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export default function App() {
  // State Autentikasi
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('uangku_token'));
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('uangku_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // State Transaksi
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState('Makanan');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterCategory, setFilterCategory] = useState('ALL');

  const handleLogout = () => {
    localStorage.removeItem('uangku_token');
    localStorage.removeItem('uangku_user');
    setToken(null);
    setUser(null);
    setTransactions([]);
  };

  // 1. Ambil data transaksi milik user yang sedang login
  useEffect(() => {
    if (!token) return;

    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const res = await fetch(API_URL, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          handleLogout();
          return;
        }
        const data = await res.json();
        setTransactions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Gagal mengambil data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [token]);

  // Handler Login & Register Manual
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const res = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: authMode,
          name: authName,
          email: authEmail,
          password: authPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan autentikasi');
      }

      localStorage.setItem('uangku_token', data.token);
      localStorage.setItem('uangku_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setAuthName('');
      setAuthEmail('');
      setAuthPassword('');
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Gagal terhubung ke server');
    } finally {
      setAuthLoading(false);
    }
  };

  const formatRupiah = (num: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  const { totalIncome, totalExpense, balance } = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter((t) => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
    return { totalIncome: income, totalExpense: expense, balance: income - expense };
  }, [transactions]);

  const chartData = useMemo(() => {
    const grouped: Record<string, number> = {};
    transactions
      .filter((t) => t.type === 'EXPENSE')
      .forEach((t) => {
        grouped[t.category] = (grouped[t.category] || 0) + t.amount;
      });
    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  // 2. Tambah transaksi baru (POST)
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount || Number(amount) <= 0 || !token) return;

    const payload = {
      title: title.trim(),
      amount: Number(amount),
      type,
      category,
      date,
    };

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Gagal menyimpan transaksi');

      const savedTx: Transaction = await res.json();
      setTransactions([savedTx, ...transactions]);
      setTitle('');
      setAmount('');
    } catch (err) {
      alert('Gagal menyimpan ke server. Coba muat ulang halaman.');
      console.error(err);
    }
  };

  // 3. Hapus transaksi (DELETE)
  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Gagal menghapus transaksi');
      setTransactions(transactions.filter((t) => t.id !== id));
    } catch (err) {
      alert('Gagal menghapus transaksi.');
      console.error(err);
    }
  };

  const filteredTransactions =
    filterCategory === 'ALL' ? transactions : transactions.filter((t) => t.category === filterCategory);

  // ==========================================
  // TAMPILAN HALAMAN LOGIN / REGISTER (BELUM LOGIN)
  // ==========================================
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center p-4 md:p-8">
        <div className="max-w-5xl w-full mx-auto">
          <div className="mb-6 flex items-center gap-2">
            <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-sm">
              U
            </div>
            <span className="text-xl font-bold text-indigo-600 tracking-tight">UANGKU</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-12">
            {/* Sisi Kiri: Penjelasan Fitur */}
            <div className="lg:col-span-6 space-y-6">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" /> Personal Cashflow & Expense Analytics
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight">
                Kendalikan Arus Kas Pribadimu dengan Lebih Jelas.
              </h1>
              <p className="text-slate-500 text-sm md:text-base leading-relaxed">
                Catat pemasukan dan pengeluaran harian, pantau rasio belanja secara otomatis lewat visualisasi interaktif, dan simpan datamu secara privat.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl mt-0.5">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Privasi Terisolasi per Akun</p>
                    <p className="text-xs text-slate-500">
                      Password terenkripsi Bcrypt dan setiap transaksi dikunci dengan JWT sehingga data pribadimu tidak pernah bocor.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl mt-0.5">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Akses Kapan Saja & Di Mana Saja</p>
                    <p className="text-xs text-slate-500">
                      Tersimpan aman di cloud database PostgreSQL—buka dari HP maupun laptop tanpa kehilangan riwayat catatan.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sisi Kanan: Form Login / Register Custom */}
            <div className="lg:col-span-6">
              <div className="bg-slate-50/70 p-6 md:p-8 rounded-2xl border border-slate-100 max-w-md mx-auto">
                {/* Tab Switcher Login / Daftar */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/60 rounded-xl mb-6">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setAuthError(''); }}
                    className={`py-2 text-sm font-semibold rounded-lg transition ${
                      authMode === 'login' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Masuk
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('register'); setAuthError(''); }}
                    className={`py-2 text-sm font-semibold rounded-lg transition ${
                      authMode === 'register' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Daftar Akun
                  </button>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {authMode === 'register' && (
                    <div>
                      <label className="text-xs font-medium text-slate-600">Nama Lengkap</label>
                      <div className="relative mt-1">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          placeholder="Contoh: Wan Sofiyah"
                          value={authName}
                          onChange={(e) => setAuthName(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-slate-600">Email</label>
                    <div className="relative mt-1">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="email"
                        placeholder="nama@email.com"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600">Password (min. 6 karakter)</label>
                    <div className="relative mt-1">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        minLength={6}
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  {authError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl">
                      {authError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow-sm"
                  >
                    {authLoading
                      ? 'Memproses...'
                      : authMode === 'login'
                      ? 'Masuk ke Dashboard'
                      : 'Buat Akun Sekarang'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // TAMPILAN DASHBOARD UTAMA (SUDAH LOGIN)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-indigo-600 tracking-tight">UANGKU</h1>
            <p className="text-sm text-slate-500">Halo, <span className="font-semibold text-slate-700">{user.name}</span></p>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full">
              <Lock className="w-3 h-3" /> Private Vault
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 px-3 py-1.5 rounded-xl transition"
            >
              <LogOut className="w-3.5 h-3.5" /> Keluar
            </button>
          </div>
        </header>

        {/* 3 KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Saldo</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatRupiah(balance)}</p>
            </div>
            <Wallet className="w-10 h-10 text-indigo-500 bg-indigo-50 p-2 rounded-xl" />
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Pemasukan</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{formatRupiah(totalIncome)}</p>
            </div>
            <ArrowUpCircle className="w-10 h-10 text-emerald-500 bg-emerald-50 p-2 rounded-xl" />
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Pengeluaran</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">{formatRupiah(totalExpense)}</p>
            </div>
            <ArrowDownCircle className="w-10 h-10 text-rose-500 bg-rose-50 p-2 rounded-xl" />
          </div>
        </div>

        {/* Form Input & Donut Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h2 className="font-semibold text-lg text-slate-800">Catat Transaksi Baru</h2>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setType('EXPENSE'); setCategory('Makanan'); }}
                className={`py-2 rounded-xl text-sm font-medium border ${
                  type === 'EXPENSE' ? 'bg-rose-50 border-rose-500 text-rose-700' : 'border-slate-200 text-slate-500'
                }`}
              >
                Pengeluaran
              </button>
              <button
                type="button"
                onClick={() => { setType('INCOME'); setCategory('Gaji'); }}
                className={`py-2 rounded-xl text-sm font-medium border ${
                  type === 'INCOME' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'border-slate-200 text-slate-500'
                }`}
              >
                Pemasukan
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">Judul Transaksi</label>
              <input
                type="text"
                placeholder="Contoh: Beli Kopi Kenangan"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Nominal (Rp)</label>
                <input
                  type="number"
                  placeholder="25000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-indigo-500"
                >
                  {type === 'EXPENSE' ? (
                    <>
                      <option value="Makanan">Makanan</option>
                      <option value="Transportasi">Transportasi</option>
                      <option value="Tagihan">Tagihan</option>
                      <option value="Belanja">Belanja</option>
                      <option value="Lainnya">Lainnya</option>
                    </>
                  ) : (
                    <>
                      <option value="Gaji">Gaji</option>
                      <option value="Bonus">Bonus</option>
                      <option value="Freelance">Freelance</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">Tanggal</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition"
            >
              <PlusCircle className="w-4 h-4" /> Simpan Transaksi
            </button>
          </form>

          {/* Donut Chart */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
            <h2 className="font-semibold text-lg text-slate-800 mb-2">Proporsi Pengeluaran</h2>
            {chartData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                Belum ada data pengeluaran
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4}>
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => formatRupiah(Number(val ?? 0))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold text-lg text-slate-800">Riwayat Transaksi</h2>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm bg-white"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="Makanan">Makanan</option>
              <option value="Transportasi">Transportasi</option>
              <option value="Tagihan">Tagihan</option>
              <option value="Belanja">Belanja</option>
              <option value="Gaji">Gaji</option>
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400 py-4">Memuat data dari server...</p>
          ) : filteredTransactions.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">Belum ada transaksi tercatat.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTransactions.map((tx) => (
                <div key={tx.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{tx.title}</p>
                    <p className="text-xs text-slate-400">
                      {tx.category} • {tx.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-semibold text-sm ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'} {formatRupiah(tx.amount)}
                    </span>
                    <button onClick={() => handleDelete(tx.id)} className="text-slate-400 hover:text-rose-500 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}