const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const maxMbSpan = $('#maxMb');
if (maxMbSpan && window.MAX_FILE_MB) maxMbSpan.textContent = window.MAX_FILE_MB;

// máscaras simples
const maskCNPJ = v => v.replace(/\D/g,'')
  .replace(/^(\d{2})(\d)/, '$1.$2')
  .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
  .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
  .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');

const maskCEP = v => v.replace(/\D/g,'').replace(/^(\d{5})(\d)/, '$1-$2').slice(0,9);

const maskTelefone = v => {
  const d = v.replace(/\D/g,'').slice(0,11);
  if (d.length <= 10) {
    return d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (m,a,b,c) => {
      if (!b) return a ? `(${a}` : '';
      if (!c) return `(${a}) ${b}`;
      return `(${a}) ${b}-${c}`;
    });
  }
  return d.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
};

const bindMask = (id, fn) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', e => e.target.value = fn(e.target.value));
};

bindMask('cnpj', maskCNPJ);
bindMask('telefonePrincipal', maskTelefone);
bindMask('telefoneFinanceiro', maskTelefone);
bindMask('cepPrincipal', maskCEP);
bindMask('cepEntrega', maskCEP);
bindMask('cepCobranca', maskCEP);

// CEP via ViaCEP
async function buscaCEP(cep, prefix) {
  const clean = cep.replace(/\D/g,'');
  if (clean.length !== 8) return alert('CEP inválido');
  try {
    const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await r.json();
    if (data.erro) return alert('CEP não encontrado');
    document.getElementById(`logradouro${prefix}`).value = data.logradouro || '';
    document.getElementById(`bairro${prefix}`).value = data.bairro || '';
    document.getElementById(`cidade${prefix}`).value = data.localidade || '';
    document.getElementById(`uf${prefix}`).value = data.uf || '';
  } catch (e) {
    alert('Falha ao consultar CEP');
  }
}

$('#btnCepPrincipal')?.addEventListener('click', () => buscaCEP($('#cepPrincipal').value, 'Principal'));
$('#btnCepEntrega')?.addEventListener('click', () => buscaCEP($('#cepEntrega').value, 'Entrega'));
$('#btnCepCobranca')?.addEventListener('click', () => buscaCEP($('#cepCobranca').value, 'Cobranca'));

// lógica condicional de seções
function toggleSections() {
  const entrega = $('#entregaIgual').value;
  const cobranca = $('#cobrancaIgual').value;
  $('#secEntrega').classList.toggle('hidden', entrega !== 'nao');
  $('#secCobranca').classList.toggle('hidden', cobranca !== 'nao');

  // requeridos dinâmicos
  const setReq = (ids, on) => ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.required = on;
  });

  setReq(['cepEntrega','logradouroEntrega','numeroEntrega','bairroEntrega','cidadeEntrega','ufEntrega'], entrega === 'nao');
  setReq(['cepCobranca','logradouroCobranca','numeroCobranca','bairroCobranca','cidadeCobranca','ufCobranca'], cobranca === 'nao');
}
$('#entregaIgual')?.addEventListener('change', toggleSections);
$('#cobrancaIgual')?.addEventListener('change', toggleSections);
toggleSections();

// bancos via BrasilAPI com fallback
async function carregaBancos() {
  const select = $('#nomeBanco');
  const fallback = [
    { ispb:"00000000", name:"Banco do Brasil S.A." },
    { ispb:"60746948", name:"Itaú Unibanco S.A." },
    { ispb:"90400888", name:"Bradesco S.A." },
    { ispb:"00360305", name:"Caixa Econômica Federal" },
    { ispb:"90442533", name:"Santander (Brasil) S.A." },
    { ispb:"92894922", name:"Nubank (Nu Pagamentos S.A.)" },
    { ispb:"18236120", name:"Banco Inter S.A." },
    { ispb:"120800","name":"Sicredi" }
  ];
  try {
    const r = await fetch('https://brasilapi.com.br/api/banks/v1');
    const data = await r.json();
    select.innerHTML = '<option value="">Selecione...</option>' +
      data.sort((a,b)=>a.name.localeCompare(b.name))
          .map(b => `<option>${b.name}</option>`).join('');
  } catch(e) {
    select.innerHTML = '<option value="">Selecione...</option>' +
      fallback.map(b => `<option>${b.name}</option>`).join('');
  }
}
carregaBancos();

// submissão com feedback
$('#form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('#status');
  status.textContent = 'Enviando...';

  const formData = new FormData(e.target);
  try {
    const r = await fetch('/submit', { method:'POST', body: formData });
    const j = await r.json();
    if (j.ok) {
      status.textContent = 'Enviado com sucesso!';
      e.target.reset();
      toggleSections();
    } else {
      status.textContent = 'Falha ao enviar. Tente novamente.';
    }
  } catch (err) {
    status.textContent = 'Erro de rede. Tente novamente.';
  }
});
