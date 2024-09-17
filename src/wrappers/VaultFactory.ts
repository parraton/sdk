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
import { HOLE_ADDRESS } from "../constatns";

export type VaultFactoryConfig = {
  adminAddress: Address;
  managerAddress: Address;
  strategyCode: Cell;
  vaultCode: Cell;
  sharesWalletCode: Cell;
  tempUpgrade: Cell;
};

export const Opcodes = {
  create_vault: 0xcbdf3140,
  create_strategy: 0x8a00e8d9,
  create_all: 0x2493d509,
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
        .storeUint(Opcodes.create_strategy, 32)
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

  async sendCreateAll(
    provider: ContractProvider,
    via: Sender,
    opts: {
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
    }
  ) {
    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(Opcodes.create_all, 32)
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

  // slice get_strategy_address(slice vault_address, slice jetton_master_address, slice pool_address, int pool_type, slice admin_address, slice jetton_vault_address, slice native_vault_address) method_id {
  //     load_storage();
  //     return calculate_strategy_address(calculate_strategy_state_init(vault_address, jetton_master_address, pool_address, pool_type, admin_address, jetton_vault_address, native_vault_address));
  // }

  async getStrategyAddress(
    provider: ContractProvider,
    vaultAddress: Address,
    jettonMasterAddress: Address,
    poolAddress: Address,
    poolType: number,
    adminAddress: Address,
    jettonVaultAddress: Address,
    nativeVaultAddress: Address
  ): Promise<Address> {
    const result = await provider.get("get_strategy_address", [
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
}
