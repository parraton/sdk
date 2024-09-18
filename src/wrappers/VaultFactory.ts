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
import { HOLE_ADDRESS } from "../constants";

export type VaultFactoryConfig = {
  adminAddress: Address;
  managerAddress: Address;
  strategyCode: Cell;
  vaultCode: Cell;
  sharesWalletCode: Cell;
  tempUpgrade: Cell;
};

export type CreateJjtAllConfig = {
  value: bigint;
  distributionPoolAddress: Address;
  managementFeeRate: bigint;
  usdtMasterAddress: Address;
  jettonMasterAddress: Address;
  poolType: number;
  poolAddress: Address;
  adminAddress: Address;
  managerAddress: Address;
  usdtVaultAddress: Address;
  jettonVaultAddress: Address;
  nativeVaultAddress: Address;
  usdtTonPoolAddress: Address;
  vaultLpWalletAddress: Address;
  strategyLpWalletAddress: Address;
  strategyUsdtWalletAddress: Address;
  strategyJettonWalletAddress: Address;
  fwdFee: bigint;
  queryId?: number;
};

export type CreateTjtAllConfig = {
  value: bigint;
  distributionPoolAddress: Address;
  managementFeeRate: bigint;
  jettonMasterAddress: Address;
  poolAddress: Address;
  poolType: number;
  adminAddress: Address;
  managerAddress: Address;
  jettonVaultAddress: Address;
  nativeVaultAddress: Address;
  vaultLpWalletAddress: Address;
  strategyLpWalletAddress: Address;
  strategyJettonWalletAddress: Address;
  fwdFee: bigint;
  queryId?: number;
};

export const Opcodes = {
  create_vault: 0xcbdf3140,
  create_tjt_strategy: 0xd2b2749c,
  create_tjt_all: 0x55796149,
  create_jjt_strategy: 0x379b4a7e,
  create_jjt_all: 0x629886da,
  set_strategy_code: 0x43157f38,
  cancel_admin_upgrade: 0xa4ed9981,
  cancel_code_upgrade: 0x357ccc67,
  init_code_upgrade: 0xdf1e233d,
  init_admin_upgrade: 0x2fb94384,
  finalize_upgrades: 0x6378509f,
};

export function vaultFactoryConfigToCell(config: VaultFactoryConfig): Cell {
  return beginCell()
    .storeAddress(config.adminAddress)
    .storeAddress(config.managerAddress)
    .storeRef(config.strategyCode)
    .storeRef(config.vaultCode)
    .storeRef(config.sharesWalletCode)
    .storeRef(VaultFactory.packInitTempUpgrade())
    .endCell();
}

export class VaultFactory implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromAddress(address: Address) {
    return new VaultFactory(address);
  }

  static createFromConfig(
    config: VaultFactoryConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = vaultFactoryConfigToCell(config);
    const init = { code, data };
    return new VaultFactory(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async sendCreateVault(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      distributionPoolAddress: Address;
      managementFeeRate: bigint;
      adminAddress: Address;
      managerAddress: Address;
      queryId?: number;
    }
  ) {
    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(Opcodes.create_vault, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .storeAddress(opts.distributionPoolAddress)
        .storeCoins(opts.managementFeeRate)
        .storeAddress(opts.adminAddress)
        .storeAddress(opts.managerAddress)
        .endCell(),
    });
  }
  async sendCreateStrategy(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      vaultAddress: Address;
      jettonMasterAddress: Address;
      poolAddress: Address;
      poolType: number;
      adminAddress: Address;
      jettonVaultAddress: Address;
      nativeVaultAddress: Address;
      queryId?: number;
    }
  ) {
    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(Opcodes.create_tjt_strategy, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .storeAddress(opts.vaultAddress)
        .storeAddress(opts.jettonMasterAddress)
        .storeAddress(opts.poolAddress)
        .storeUint(opts.poolType, 1)
        .storeRef(
          beginCell()
            .storeAddress(opts.adminAddress)
            .storeAddress(opts.jettonVaultAddress)
            .storeAddress(opts.nativeVaultAddress)
            .endCell()
        )
        .endCell(),
    });
  }

  static packInitTempUpgrade() {
    return beginCell()
      .storeUint(0, 64)
      .storeUint(0, 64)
      .storeAddress(HOLE_ADDRESS)
      .storeRef(Cell.EMPTY)
      .endCell();
  }

  static unpackTempUpgrade(cell: Cell) {
    const slice = cell.beginParse();
    return {
      endCode: slice.loadUint(64),
      endAdmin: slice.loadUint(64),
      admin: slice.loadAddress(),
      code: slice.loadRef(),
    };
  }

  async sendCreateTjtAll(
    provider: ContractProvider,
    via: Sender,
    opts: CreateTjtAllConfig
  ) {
    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(Opcodes.create_tjt_all, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .storeAddress(opts.distributionPoolAddress)
        .storeAddress(opts.adminAddress)
        .storeAddress(opts.managerAddress)
        .storeUint(opts.managementFeeRate, 16)
        .storeRef(
          beginCell()
            .storeAddress(opts.jettonMasterAddress)
            .storeAddress(opts.jettonVaultAddress)
            .storeAddress(opts.poolAddress)
            .storeUint(opts.poolType, 1)
            .endCell()
        )
        .storeRef(
          beginCell()
            .storeAddress(opts.nativeVaultAddress)
            .storeAddress(opts.vaultLpWalletAddress)
            .storeAddress(opts.strategyLpWalletAddress)
            .endCell()
        )
        .storeRef(
          beginCell()
            .storeAddress(opts.strategyJettonWalletAddress)
            .storeCoins(opts.fwdFee)
            .endCell()
        )
        .endCell(),
    });
  }

  async sendCreateJjtAll(
    provider: ContractProvider,
    via: Sender,
    opts: CreateJjtAllConfig
  ) {
    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(Opcodes.create_jjt_all, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .storeAddress(opts.distributionPoolAddress)
        .storeAddress(opts.adminAddress)
        .storeAddress(opts.managerAddress)
        .storeUint(opts.managementFeeRate, 16)
        .storeRef(
          beginCell()
            .storeAddress(opts.usdtMasterAddress)
            .storeAddress(opts.jettonMasterAddress)
            .storeAddress(opts.poolAddress)
            .storeUint(opts.poolType, 1)
            .endCell()
        )
        .storeRef(
          beginCell()
            .storeAddress(opts.usdtVaultAddress)
            .storeAddress(opts.jettonVaultAddress)
            .storeAddress(opts.nativeVaultAddress)
            .endCell()
        )
        .storeRef(
          beginCell()
            .storeAddress(opts.usdtTonPoolAddress)
            .storeAddress(opts.vaultLpWalletAddress)
            .storeAddress(opts.strategyLpWalletAddress)
            .endCell()
        )
        .storeRef(
          beginCell()
            .storeAddress(opts.strategyUsdtWalletAddress)
            .storeAddress(opts.strategyJettonWalletAddress)
            .storeCoins(opts.fwdFee)
            .endCell()
        )
        .endCell(),
    });
  }

  async getVaultAddress(
    provider: ContractProvider,
    distributionPoolAddress: Address,
    managementFeeRate: bigint,
    adminAddress: Address,
    managerAddress: Address
  ): Promise<Address> {
    const result = await provider.get("get_vault_address", [
      {
        type: "slice",
        cell: beginCell().storeAddress(distributionPoolAddress).endCell(),
      },
      {
        type: "int",
        value: managementFeeRate,
      },
      {
        type: "slice",
        cell: beginCell().storeAddress(adminAddress).endCell(),
      },
      {
        type: "slice",
        cell: beginCell().storeAddress(managerAddress).endCell(),
      },
    ]);
    return result.stack.readAddress();
  }

  async getTjtStrategyAddress(
    provider: ContractProvider,
    vaultAddress: Address,
    jettonMasterAddress: Address,
    poolAddress: Address,
    poolType: number,
    adminAddress: Address,
    jettonVaultAddress: Address,
    nativeVaultAddress: Address
  ): Promise<Address> {
    const result = await provider.get("get_tjt_strategy_address", [
      {
        type: "slice",
        cell: beginCell().storeAddress(vaultAddress).endCell(),
      },
      {
        type: "slice",
        cell: beginCell().storeAddress(jettonMasterAddress).endCell(),
      },
      {
        type: "slice",
        cell: beginCell().storeAddress(poolAddress).endCell(),
      },
      {
        type: "int",
        value: BigInt(poolType),
      },
      {
        type: "slice",
        cell: beginCell().storeAddress(adminAddress).endCell(),
      },
      {
        type: "slice",
        cell: beginCell().storeAddress(jettonVaultAddress).endCell(),
      },
      {
        type: "slice",
        cell: beginCell().storeAddress(nativeVaultAddress).endCell(),
      },
    ]);
    return result.stack.readAddress();
  }

  async getJjtStrategyAddress(
    provider: ContractProvider,
    vaultAddress: Address,
    jettonMasterAddress: Address,
    poolAddress: Address,
    poolType: number,
    usdtMasterAddress: Address,
    adminAddress: Address,
    usdtVaultAddress: Address,
    jettonVaultAddress: Address,
    nativeVaultAddress: Address,
    usdtTonPoolAddress: Address
  ): Promise<Address> {
    const result = await provider.get("get_jjt_strategy_address", [
      {
        type: "slice",
        cell: beginCell().storeAddress(vaultAddress).endCell(),
      },
      {
        type: "slice",
        cell: beginCell().storeAddress(jettonMasterAddress).endCell(),
      },
      {
        type: "slice",
        cell: beginCell().storeAddress(poolAddress).endCell(),
      },
      {
        type: "int",
        value: BigInt(poolType),
      },
      {
        type: "slice",
        cell: beginCell().storeAddress(usdtMasterAddress).endCell(),
      },
      {
        type: "slice",
        cell: beginCell().storeAddress(adminAddress).endCell(),
      },
      {
        type: "slice",
        cell: beginCell().storeAddress(usdtVaultAddress).endCell(),
      },
      {
        type: "slice",
        cell: beginCell().storeAddress(jettonVaultAddress).endCell(),
      },
      {
        type: "slice",
        cell: beginCell().storeAddress(nativeVaultAddress).endCell(),
      },
      {
        type: "slice",
        cell: beginCell().storeAddress(usdtTonPoolAddress).endCell(),
      },
    ]);
    return result.stack.readAddress();
  }
}
