import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    signInWithEmailAndPassword, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- REFERENCIAS DOM ---
const refs = {
    authView: document.getElementById('auth-view'),
    appView: document.getElementById('app-view'),
    loginForm: document.getElementById('login-form'),
    authError: document.getElementById('auth-error'),
    logoutBtn: document.getElementById('logout-btn'),
    
    viewList: document.getElementById('view-list'),
    viewCreate: document.getElementById('view-create'),
    tabList: document.getElementById('tab-list'),
    tabCreate: document.getElementById('tab-create'),
    tabCreateText: document.getElementById('tab-create-text'),
    
    quoteForm: document.getElementById('quote-form'),
    formTitle: document.getElementById('form-title'),
    submitBtn: document.getElementById('submit-btn'),
    cancelEditBtn: document.getElementById('cancel-edit-btn'),
    editId: document.getElementById('edit-id'),
    
    itemsList: document.getElementById('items-list'),
    previewSubtotal: document.getElementById('preview-subtotal'),
    previewTax: document.getElementById('preview-tax'),
    previewTotal: document.getElementById('preview-total'),
    
    quotesContainer: document.getElementById('quotes-container'),
    searchInput: document.getElementById('search-input'),
    filterStatus: document.getElementById('filter-status'),
    totalQuotes: document.getElementById('total-quotes'),
    toast: document.getElementById('toast'),
    
    pdfTemplate: document.getElementById('pdf-template')
};

const COLLECTION_NAME = 'quotes';
let allQuotes = [];
const TAX_RATE = 0.16;

// --- AUTH SYSTEM ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        refs.authView.classList.add('hidden');
        refs.appView.classList.remove('hidden');
        initApp();
    } else {
        refs.authView.classList.remove('hidden');
        refs.appView.classList.add('hidden');
    }
});

refs.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    refs.authError.classList.add('hidden');

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        refs.authError.textContent = "Error de autenticación: " + error.message;
        refs.authError.classList.remove('hidden');
    }
});

refs.logoutBtn.addEventListener('click', () => signOut(auth));

// --- GLOBAL APP LOGIC ---
window.app = window.app || {};

function initApp() {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    onSnapshot(q, (querySnapshot) => {
        allQuotes = [];
        querySnapshot.forEach((doc) => allQuotes.push({ id: doc.id, ...doc.data() }));
        renderQuotes();
    });
}

// --- TABS & FORM MODES ---
window.app.switchTab = (tabName) => {
    if (tabName === 'list') {
        refs.viewList.classList.remove('hidden');
        refs.viewCreate.classList.add('hidden');
        refs.tabList.classList.add('border-primary', 'text-primary');
        refs.tabCreate.classList.remove('border-primary', 'text-primary');
        app.cancelEdit(); // Reset form if leaving
    } else {
        refs.viewList.classList.add('hidden');
        refs.viewCreate.classList.remove('hidden');
        refs.tabList.classList.remove('border-primary', 'text-primary');
        refs.tabCreate.classList.add('border-primary', 'text-primary');
        
        if (!refs.editId.value) {
            // Only defaults if not editing
            const date = new Date();
            date.setDate(date.getDate() + 15);
            document.getElementById('validUntil').value = date.toISOString().split('T')[0];
            if(refs.itemsList.children.length === 0) window.app.addItemRow();
        }
    }
};

window.app.cancelEdit = () => {
    refs.quoteForm.reset();
    refs.editId.value = '';
    refs.formTitle.textContent = "Crear Nueva Cotización";
    refs.tabCreateText.textContent = "Nueva Cotización";
    refs.submitBtn.textContent = "Guardar Cotización";
    refs.cancelEditBtn.classList.add('hidden');
    refs.itemsList.innerHTML = '';
    calculateTotals();
};

// --- FORM ITEMS LOGIC ---
window.app.addItemRow = (description = '', qty = 1, price = 0) => {
    const tr = document.createElement('tr');
    tr.className = "border-b border-gray-100";
    tr.innerHTML = `
        <td class="p-2">
            <input type="text" class="item-desc w-full px-2 py-1 border rounded focus:ring-1 focus:ring-primary outline-none" value="${description}" required>
        </td>
        <td class="p-2">
            <input type="number" min="1" class="item-qty w-full px-2 py-1 border rounded focus:ring-1 focus:ring-primary outline-none text-center" value="${qty}" oninput="app.calcRow(this)">
        </td>
        <td class="p-2">
            <input type="number" min="0" step="0.01" class="item-price w-full px-2 py-1 border rounded focus:ring-1 focus:ring-primary outline-none text-right" value="${price}" oninput="app.calcRow(this)">
        </td>
        <td class="p-2 text-right font-medium text-gray-700">
            <span class="item-total">$${(qty * price).toFixed(2)}</span>
        </td>
        <td class="p-2 text-center">
            <button type="button" class="text-red-400 hover:text-red-600" onclick="app.removeRow(this)">Eliminar</button>
        </td>
    `;
    refs.itemsList.appendChild(tr);
    calculateTotals();
};

window.app.calcRow = (input) => {
    const tr = input.closest('tr');
    const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
    const price = parseFloat(tr.querySelector('.item-price').value) || 0;
    tr.querySelector('.item-total').textContent = `$${(qty * price).toFixed(2)}`;
    calculateTotals();
};

window.app.removeRow = (btn) => {
    if (refs.itemsList.children.length > 1) {
        btn.closest('tr').remove();
        calculateTotals();
    }
};

const calculateTotals = () => {
    let subtotal = 0;
    document.querySelectorAll('#items-list tr').forEach(tr => {
        const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
        const price = parseFloat(tr.querySelector('.item-price').value) || 0;
        subtotal += qty * price;
    });
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    refs.previewSubtotal.textContent = `$${subtotal.toFixed(2)}`;
    refs.previewTax.textContent = `$${tax.toFixed(2)}`;
    refs.previewTotal.textContent = `$${total.toFixed(2)}`;
    return { subtotal, tax, total };
};

// --- CRUD OPERATIONS ---
refs.quoteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Collect Data
    const data = {
        client: {
            name: document.getElementById('clientName').value,
            company: document.getElementById('clientCompany').value,
            email: document.getElementById('clientEmail').value
        },
        items: [],
        validUntil: document.getElementById('validUntil').value,
    };

    document.querySelectorAll('#items-list tr').forEach(tr => {
        const qty = parseFloat(tr.querySelector('.item-qty').value);
        const price = parseFloat(tr.querySelector('.item-price').value);
        data.items.push({
            description: tr.querySelector('.item-desc').value,
            quantity: qty,
            price: price,
            total: qty * price
        });
    });

    data.totals = calculateTotals();
    const editId = refs.editId.value;

    try {
        if (editId) {
            // UPDATE
            await updateDoc(doc(db, COLLECTION_NAME, editId), data);
            showToast('Cotización actualizada');
        } else {
            // CREATE
            data.status = 'pendiente';
            data.createdAt = serverTimestamp();
            data.number = `COT-${Date.now().toString().slice(-6)}`;
            await addDoc(collection(db, COLLECTION_NAME), data);
            showToast('Cotización creada');
        }
        window.app.switchTab('list');
    } catch (e) {
        console.error(e);
        showToast('Error al guardar', 'error');
    }
});

window.app.editQuote = (id) => {
    const quote = allQuotes.find(q => q.id === id);
    if (!quote) return;

    // Fill form
    refs.editId.value = quote.id;
    document.getElementById('clientName').value = quote.client.name;
    document.getElementById('clientCompany').value = quote.client.company;
    document.getElementById('clientEmail').value = quote.client.email;
    document.getElementById('validUntil').value = quote.validUntil;

    // Fill items
    refs.itemsList.innerHTML = '';
    quote.items.forEach(item => {
        app.addItemRow(item.description, item.quantity, item.price);
    });

    // UI Updates
    refs.formTitle.textContent = `Editando Cotización #${quote.number}`;
    refs.tabCreateText.textContent = "Editando...";
    refs.submitBtn.textContent = "Actualizar Cotización";
    refs.cancelEditBtn.classList.remove('hidden');

    app.switchTab('create');
};

window.app.deleteQuote = async (id) => {
    if(confirm('¿Seguro que deseas eliminar esta cotización?')) {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        showToast('Eliminada correctamente');
    }
};

window.app.toggleStatus = async (id, currentStatus) => {
    const states = ['pendiente', 'aprobada', 'rechazada'];
    const next = states[(states.indexOf(currentStatus) + 1) % states.length];
    await updateDoc(doc(db, COLLECTION_NAME, id), { status: next });
};

// --- PDF EXPORT ---
window.app.exportPDF = (id) => {
    const quote = allQuotes.find(q => q.id === id);
    if (!quote) return;

    const itemsHtml = quote.items.map(item => `
        <tr style="border-bottom:1px solid #eee;">
            <td style="padding:8px;">${item.description}</td>
            <td style="padding:8px;text-align:center;">${item.quantity}</td>
            <td style="padding:8px;text-align:right;">$${item.price.toFixed(2)}</td>
            <td style="padding:8px;text-align:right;">$${item.total.toFixed(2)}</td>
        </tr>
    `).join('');

    const template = `
        <div style="font-family: sans-serif; color: #333;">
            <div style="display:flex; justify-content:space-between; margin-bottom: 40px;">
                <div>
                    <h1 style="color:#2563eb; margin:0;">CotizaWeb</h1>
                    <p style="margin:5px 0;">Dev Services</p>
                </div>
                <div style="text-align:right;">
                    <h2 style="margin:0;">COTIZACIÓN</h2>
                    <p style="color:#666; margin:5px 0;">#${quote.number}</p>
                    <p style="font-size:12px;">Fecha: ${new Date().toLocaleDateString()}</p>
                </div>
            </div>

            <div style="margin-bottom: 30px; padding: 15px; background: #f9fafb; border-radius: 8px;">
                <h3 style="margin-top:0; border-bottom:1px solid #ddd; padding-bottom:5px;">Cliente</h3>
                <p><strong>${quote.client.name}</strong><br>
                ${quote.client.company}<br>
                ${quote.client.email}</p>
            </div>

            <table style="width:100%; border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                    <tr style="background:#2563eb; color:white;">
                        <th style="padding:10px; text-align:left;">Descripción</th>
                        <th style="padding:10px; text-align:center;">Cant.</th>
                        <th style="padding:10px; text-align:right;">Precio</th>
                        <th style="padding:10px; text-align:right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div style="text-align:right; margin-top:20px;">
                <p>Subtotal: <strong>$${quote.totals.subtotal.toFixed(2)}</strong></p>
                <p>Impuestos: <strong>$${quote.totals.tax.toFixed(2)}</strong></p>
                <h3 style="color:#2563eb;">Total: $${quote.totals.total.toFixed(2)}</h3>
            </div>
        </div>
    `;

    refs.pdfTemplate.innerHTML = template;
    
    html2pdf()
        .set({ margin: 10, filename: `Cotizacion-${quote.number}.pdf` })
        .from(refs.pdfTemplate)
        .save();
};

// --- RENDER ---
const renderQuotes = () => {
    const search = refs.searchInput.value.toLowerCase();
    const status = refs.filterStatus.value;

    const filtered = allQuotes.filter(q => {
        const matchesSearch = 
            (q.client.name.toLowerCase().includes(search)) ||
            (q.client.company && q.client.company.toLowerCase().includes(search)) ||
            (q.number && q.number.toLowerCase().includes(search));
        const matchesStatus = status === 'all' || q.status === status;
        return matchesSearch && matchesStatus;
    });

    refs.totalQuotes.textContent = filtered.length;
    refs.quotesContainer.innerHTML = '';

    filtered.forEach(quote => {
        let statusColor = 'bg-yellow-100 text-yellow-800';
        if(quote.status === 'aprobada') statusColor = 'bg-green-100 text-green-800';
        if(quote.status === 'rechazada') statusColor = 'bg-red-100 text-red-800';

        const card = document.createElement('div');
        card.className = "bg-white rounded-xl shadow-sm border border-gray-100 p-5";
        card.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <span class="font-mono text-xs bg-gray-100 px-2 py-1 rounded">#${quote.number}</span>
                <span class="px-2 py-1 rounded text-xs font-bold uppercase cursor-pointer ${statusColor}" onclick="app.toggleStatus('${quote.id}', '${quote.status}')">${quote.status}</span>
            </div>
            
            <h3 class="font-bold text-lg">${quote.client.name}</h3>
            <p class="text-sm text-gray-500 mb-4">${quote.client.company || ''}</p>
            
            <div class="border-t pt-4 flex justify-between items-center">
                <span class="text-xl font-bold text-primary">$${quote.totals.total.toFixed(2)}</span>
                <div class="flex gap-2">
                    <button onclick="app.exportPDF('${quote.id}')" class="text-gray-400 hover:text-blue-500" title="PDF">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </button>
                    <button onclick="app.editQuote('${quote.id}')" class="text-gray-400 hover:text-green-500" title="Editar">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onclick="app.deleteQuote('${quote.id}')" class="text-gray-400 hover:text-red-500" title="Eliminar">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </div>
        `;
        refs.quotesContainer.appendChild(card);
    });
};

const showToast = (msg, type = 'success') => {
    refs.toast.textContent = msg;
    refs.toast.className = `fixed bottom-5 right-5 px-6 py-3 rounded shadow-lg transform transition-all duration-300 z-50 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white translate-y-0 opacity-100`;
    setTimeout(() => {
        refs.toast.classList.add('translate-y-20', 'opacity-0');
        refs.toast.classList.remove('translate-y-0', 'opacity-100');
    }, 3000);
};

// Listeners Filtros
refs.searchInput.addEventListener('input', renderQuotes);
refs.filterStatus.addEventListener('change', renderQuotes);
