import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
} from "@ton/core";

export type SharesWalletConfig = {
  balance: bigint;
  ownerAddress: Address;
  jettonMasterAddress: Address;
  jettonWalletCode: Cell;
};

export function sharesWalletConfigToCell(config: SharesWalletConfig): Cell {
  return beginCell()
    .storeCoins(config.balance)
    .storeAddress(config.ownerAddress)
    .storeAddress(config.jettonMasterAddress)
    .storeRef(config.jettonWalletCode)
    .endCell();
}

export interface SharesWalletFees {
  transferFee: bigint;
  internalTransferFee: bigint;
  burnFee: bigint;
}

// export const Opcodes = {
//     transfer: 0xf8a7ea5,
//     internal_transfer: 0x178d4519,
//     burn: 0x595f07bc,
// };

export class SharesWallet implements Contract {
  static readonly OPS = {
    transfer: 0xf8a7ea5,
    internal_transfer: 0x178d4519,
    burn: 0x595f07bc,
    burn_notification: 0x7bdd97de,
    transfer_notification: 0x7362d09c,
    withdraw_jettons: 0x18a9ed91,
    withdraw_ton: 0xa38b63c,
  };

  static readonly EXIT_CODES = {
    wrong_op: 0xffff,
    not_owner: 73,
    not_valid_wallet: 74,
    wrong_workchain: 333,
    balance_error: 47,
    not_enough_gas: 48,
    invalid_message: 49,
  };

  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromAddress(address: Address) {
    return new SharesWallet(address);
  }

  static createFromConfig(
    config: SharesWalletConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = sharesWalletConfigToCell(config);
    const init = { code, data };
    return new SharesWallet(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async sendWithdrawJettons(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      walletAddress: Address;
      amount: bigint;
      customPayload?: Cell;
      queryId?: number;
    }
  ) {
    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(SharesWallet.OPS.withdraw_jettons, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .storeAddress(opts.walletAddress)
        .storeCoins(opts.amount)
        .storeMaybeRef(opts.customPayload)
        .endCell(),
    });
  }

  async sendWithdrawTon(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      queryId?: number;
    }
  ) {
    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(SharesWallet.OPS.withdraw_ton, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .endCell(),
    });
  }

  async sendTransfer(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      queryId?: number | bigint;
      destination: Address;
      amount: bigint;
      responseAddress?: Address | null;
      customPayload?: Cell;
      forwardAmount?: bigint;
      forwardPayload?: Cell;
    }
  ) {
    const body = beginCell()
      .storeUint(SharesWallet.OPS.transfer, 32)
      .storeUint(opts.queryId ?? 0, 64)
      .storeCoins(opts.amount)
      .storeAddress(opts.destination)
      .storeAddress(opts.responseAddress)
      .storeMaybeRef(opts.customPayload)
      .storeCoins(opts.forwardAmount ?? 0)
      .storeMaybeRef(opts.forwardPayload)
      .endCell();

    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body,
    });
  }

  async sendInternalTransfer(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      queryId?: number | bigint;
      fromAddress: Address;
      amount: bigint;
      responseAddress: Address | null;
      forwardAmount: bigint;
      forwardPayload?: Cell;
    }
  ) {
    const body = beginCell()
      .storeUint(SharesWallet.OPS.internal_transfer, 32)
      .storeUint(opts.queryId ?? 0, 64)
      .storeCoins(opts.amount)
      .storeAddress(opts.fromAddress)
      .storeAddress(opts.responseAddress)
      .storeCoins(opts.forwardAmount ?? 0)
      .storeMaybeRef(opts.forwardPayload)
      .endCell();

    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body,
    });
  }

  async sendBurn(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      queryId?: number | bigint;
      amount: bigint;
      responseAddress?: Address | null;
      customPayload?: Cell;
    }
  ) {
    const body = beginCell()
      .storeUint(SharesWallet.OPS.burn, 32)
      .storeUint(opts.queryId ?? 0, 64)
      .storeCoins(opts.amount)
      .storeAddress(opts.responseAddress)
      .storeMaybeRef(opts.customPayload)
      .endCell();

    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body,
    });
  }
  async getWalletData(provider: ContractProvider): Promise<SharesWalletConfig> {
    const result = await provider.get("get_wallet_data", []);
    return {
      balance: result.stack.readBigNumber(),
      ownerAddress: result.stack.readAddress(),
      jettonMasterAddress: result.stack.readAddress(),
      jettonWalletCode: result.stack.readCell(),
    };
  }
}
