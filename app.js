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
    }, (error) => {
        console.error("Error obteniendo datos: ", error);
        if (error.code === 'permission-denied') {
            showToast('Permiso denegado. Intenta cerrar sesión y volver a entrar.', 'error');
        } else {
            showToast('Error de conexión con Firebase.', 'error');
        }
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
        <tr class="border-b border-gray-200">
            <td class="py-3 px-4">${item.description}</td>
            <td class="py-3 px-4 text-center">${item.quantity}</td>
            <td class="py-3 px-4 text-right">$${item.price.toFixed(2)}</td>
            <td class="py-3 px-4 text-right font-medium">$${item.total.toFixed(2)}</td>
        </tr>
    `).join('');

    const content = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Cotización #${quote.number}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
            <style>
                @media print {
                    .no-print { display: none !important; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body class="bg-gray-100 min-h-screen p-8">
            <!-- Toolbar -->
            <div class="no-print max-w-[210mm] mx-auto mb-6 flex justify-between items-center bg-white p-4 rounded-lg shadow-md border border-gray-200">
                <div class="font-semibold text-gray-700">Vista Previa</div>
                <div class="flex gap-3">
                    <button onclick="window.close()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md font-medium transition">
                        Cerrar
                    </button>
                    <button onclick="downloadImage()" class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md font-bold flex items-center gap-2 transition shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Descargar Imagen
                    </button>
                    <button onclick="window.print()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold flex items-center gap-2 transition shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        Imprimir / PDF
                    </button>
                </div>
            </div>

            <!-- Page A4 -->
            <div id="capture-target" class="mx-auto bg-white shadow-xl overflow-hidden" style="width: 210mm; min-height: 297mm;">
                <div class="p-12">
                    <!-- Header -->
                    <div class="flex justify-between items-start mb-12">
                        <div>
                            <h1 class="text-4xl font-extrabold text-blue-600 tracking-tight">Ing.Leonardo Maldonado</h1>
                            <div class="text-gray-500 mt-1 font-medium">Dev Services</div>
                        </div>
                        <div class="text-right">
                            <h2 class="text-2xl font-bold text-gray-800">COTIZACIÓN</h2>
                            <div class="text-gray-500 mt-1">#${quote.number}</div>
                            <div class="text-sm text-gray-400 mt-1">Fecha: ${new Date().toLocaleDateString()}</div>
                        </div>
                    </div>

                    <!-- Client Info -->
                    <div class="bg-gray-50 rounded-lg p-6 mb-8 border border-gray-100">
                        <div class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Cliente</div>
                        <div class="text-xl font-bold text-gray-800">${quote.client.name}</div>
                        ${quote.client.company ? `<div class="text-gray-600">${quote.client.company}</div>` : ''}
                        <div class="text-blue-500 text-sm mt-1">${quote.client.email}</div>
                    </div>

                    <!-- Items Table -->
                    <table class="w-full mb-8">
                        <thead>
                            <tr class="bg-blue-600 text-white text-xs uppercase tracking-wider">
                                <th class="py-3 px-4 text-left rounded-tl-lg">Descripción</th>
                                <th class="py-3 px-4 text-center">Cant.</th>
                                <th class="py-3 px-4 text-right">Precio</th>
                                <th class="py-3 px-4 text-right rounded-tr-lg">Total</th>
                            </tr>
                        </thead>
                        <tbody class="text-sm text-gray-700">
                            ${itemsHtml}
                        </tbody>
                    </table>

                    <!-- Totals -->
                    <div class="flex justify-end">
                        <div class="w-1/2 space-y-3">
                            <div class="flex justify-between text-gray-600 border-b border-gray-100 pb-2">
                                <span>Subtotal:</span>
                                <span>$${quote.totals.subtotal.toFixed(2)}</span>
                            </div>
                            <div class="flex justify-between text-gray-600 border-b border-gray-100 pb-2">
                                <span>Impuestos (16%):</span>
                                <span>$${quote.totals.tax.toFixed(2)}</span>
                            </div>
                            <div class="flex justify-between text-2xl font-bold text-blue-600 pt-2">
                                <span>Total:</span>
                                <span>$${quote.totals.total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="text-center text-gray-400 text-xs border-t pt-8 mt-12">
                        <p>Gracias por su preferencia. Esta cotización es válida hasta ${new Date(quote.validUntil).toLocaleDateString()}.</p>
                    </div>
                </div>
            </div>

            <script>
                function downloadImage() {
                    const btn = document.querySelector('button[onclick="downloadImage()"]');
                    const originalText = btn.innerHTML;
                    btn.innerHTML = 'Generando...';
                    
                    const element = document.getElementById('capture-target');
                    html2canvas(element, { 
                        scale: 2,
                        logging: false,
                        useCORS: true
                    }).then(canvas => {
                        const link = document.createElement('a');
                        link.download = 'Cotizacion-${quote.number}.png';
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                        btn.innerHTML = originalText;
                    }).catch(err => {
                        console.error(err);
                        alert('Error generando la imagen');
                        btn.innerHTML = originalText;
                    });
                }
            </script>
        </body>
        </html>
    `;

    // Wait for content to load before writing
    setTimeout(() => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(content);
            printWindow.document.close();
        } else {
            alert('Por favor habilita las ventanas emergentes para ver la cotización.');
        }
    }, 100);
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
