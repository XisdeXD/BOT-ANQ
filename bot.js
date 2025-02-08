require("dotenv").config();
const fs = require("fs");
const { Client, GatewayIntentBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

const LOG_CHANNEL = "log-faccao";
const DATABASE_FILE = "database.json";

function loadDatabase() {
  if (fs.existsSync(DATABASE_FILE)) {
    return JSON.parse(fs.readFileSync(DATABASE_FILE, "utf8"));
  }
  return { 
    bauGerencia: [], 
    bauMembros: [], 
    acoes: [], 
    financeiro: { saldo: 0, transacoes: [] },
    membros: {},
    veiculos: []
  };
}

function saveDatabase() {
  fs.writeFileSync(DATABASE_FILE, JSON.stringify(database, null, 2));
}

const database = loadDatabase();

client.once("ready", () => {
  console.log(`${client.user.tag} está online!`);
});

function logMessage(guild, embed) {
  const logChannel = guild.channels.cache.find(ch => ch.name === LOG_CHANNEL);
  if (logChannel) logChannel.send({ embeds: [embed] });
}

async function createModal(interaction, customId, title, label) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  const input = new TextInputBuilder().setCustomId("input").setLabel(label).setStyle(TextInputStyle.Paragraph);
  const actionRow = new ActionRowBuilder().addComponents(input);
  modal.addComponents(actionRow);
  await interaction.showModal(modal);
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const commands = {
    "entrada-gerencia": "entradaGerenciaModal",
    "saida-gerencia": "saidaGerenciaModal",
    "entrada-membros": "entradaMembrosModal",
    "saida-membros": "saidaMembrosModal",
    "registrar-acao": "registrarAcaoModal",
    "depositar": "depositarModal",
    "sacar": "sacarModal",
    "ver-bau-gerencia": "listarGerencia",
    "ver-bau-membros": "listarMembros",
    "ver-saldo": "verSaldo",
    "adicionar-membro": "adicionarMembroModal",
    "remover-membro": "removerMembroModal",
    "cadastrar-veiculo": "cadastrarVeiculoModal",
    "remover-veiculo": "removerVeiculoModal"
  };

  if (commands[interaction.commandName]) {
    if (interaction.commandName.startsWith("ver")) {
      listarDados(interaction, interaction.commandName);
    } else {
      await createModal(interaction, commands[interaction.commandName], "Registro", "Digite as informações");
    }
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  const input = interaction.fields.getTextInputValue("input");
  const usuario = interaction.user.tag;
  const data = new Date().toLocaleString();

  switch (interaction.customId) {
    case "entradaGerenciaModal":
    case "saidaGerenciaModal":
      database.bauGerencia.push({ usuario, item: input, data, tipo: interaction.customId.includes("entrada") ? "entrada" : "saida" });
      break;
    case "entradaMembrosModal":
    case "saidaMembrosModal":
      database.bauMembros.push({ usuario, item: input, data, tipo: interaction.customId.includes("entrada") ? "entrada" : "saida" });
      break;
    case "registrarAcaoModal":
      database.acoes.push({ usuario, detalhes: input, data, resultado: "Pendente" });
      break;
    case "depositarModal":
    case "sacarModal":
      const valor = parseFloat(input);
      if (isNaN(valor) || valor <= 0) return interaction.reply("Valor inválido!");
      if (interaction.customId === "depositarModal") database.financeiro.saldo += valor;
      else if (database.financeiro.saldo >= valor) database.financeiro.saldo -= valor;
      else return interaction.reply("Saldo insuficiente!");
      database.financeiro.transacoes.push({ usuario, tipo: interaction.customId === "depositarModal" ? "Depósito" : "Saque", valor, data });
      break;
    case "adicionarMembroModal":
      database.membros[input] = { cargo: "Membro", dataEntrada: data };
      break;
    case "removerMembroModal":
      delete database.membros[input];
      break;
    case "cadastrarVeiculoModal":
      database.veiculos.push({ placa: input, registradoPor: usuario, data });
      break;
    case "removerVeiculoModal":
      database.veiculos = database.veiculos.filter(v => v.placa !== input);
      break;
  }

  saveDatabase();

  const embed = new EmbedBuilder()
    .setColor("BLUE")
    .setTitle("📜 Registro Adicionado")
    .setDescription(`🔹 **Usuário:** ${usuario}\n🔹 **Dado:** ${input}\n🔹 **Data:** ${data}`)
    .setTimestamp();
  await interaction.reply({ embeds: [embed] });
  logMessage(interaction.guild, embed);
});

function listarDados(interaction, tipo) {
  let registros = [];
  if (tipo === "ver-bau-gerencia") registros = database.bauGerencia;
  else if (tipo === "ver-bau-membros") registros = database.bauMembros;
  else if (tipo === "ver-saldo") return interaction.reply(`💰 Saldo atual: R$${database.financeiro.saldo.toFixed(2)}`);

  if (registros.length === 0) return interaction.reply("📭 Nenhum registro encontrado.");
  const embed = new EmbedBuilder()
    .setColor("GREEN")
    .setTitle("📊 Histórico")
    .setDescription(registros.map(r => `👤 ${r.usuario} | 📦 ${r.item || r.tipo} | 📅 ${r.data}`).join("\n"))
    .setTimestamp();
  interaction.reply({ embeds: [embed] });
}

client.login(process.env.TOKEN);
