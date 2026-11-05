/** Pede às telas abertas que recarreguem os dados (ex.: chegou atualização do ambiente compartilhado). */
export const recarregarTelas = () => window.dispatchEvent(new Event("lexco:recarregar-telas"));
