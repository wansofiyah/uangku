import { useState, useMemo, useEffect } from 'react';
import { Wallet, ArrowUpCircle, ArrowDownCircle, Trash2, PlusCircle, Lock } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { type Transaction, type TransactionType } from './types';
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/clerk-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/transactions';
const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6'];

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState('Makanan');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const { getToken, isSignedIn } = useAuth();

  // 1. Ambil data dari Backend Golang hanya jika user sudah login
  useEffect(() => {
    if (!isSignedIn) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const res = await fetch(API_URL, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await res.json();
        setTransactions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Gagal mengambil data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [isSignedIn, getToken]);

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

  // 2. Kirim transaksi baru ke Backend Golang dengan Token JWT (POST)
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount || Number(amount) <= 0) return;

    const payload = {
      title: title.trim(),
      amount: Number(amount),
      type,
      category,
      date,
    };

    try {
      const token = await getToken();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Gagal menyimpan transaksi');

      const savedTx: Transaction = await res.json();
      setTransactions([savedTx, ...transactions]);
      setTitle('');
      setAmount('');
    } catch (err) {
      alert('Gagal menyimpan ke server. Pastikan koneksi dan login aktif!');
      console.error(err);
    }
  };

  // 3. Hapus transaksi milik user di Backend Golang (DELETE)
  const handleDelete = async (id: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-indigo-600 tracking-tight">UANGKU</h1>
            <p className="text-sm text-slate-500">Personal Cashflow & Expense Analytics</p>
          </div>

          <div className="flex items-center gap-3">
            <SignedIn>
              <span className="hidden sm:inline-block text-xs font-medium bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">
                Private Vault
              </span>
              <UserButton />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition">
                  Masuk / Daftar
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </header>

        {/* Tampilan jika user BELUM login */}
        <SignedOut>
          <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-100 text-center space-y-4 max-w-lg mx-auto mt-12">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Catatan Keuangan Pribadi & Aman</h2>
            <p className="text-sm text-slate-500">
              Silakan masuk menggunakan akun Google atau Email untuk mencatat dan melihat laporan keuangan pribadimu.
            </p>
            <SignInButton mode="modal">
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-xl text-sm transition">
                Mulai Sekarang
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        {/* Tampilan Dashboard utama jika user SUDAH login */}
        <SignedIn>
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
        </SignedIn>
      </div>
    </div>
  );
}