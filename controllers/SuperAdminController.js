const SuperAdmin = require("../models/SuperAdmin");
const Admin = require("../models/Admin");
const Users = require("../models/User");

const { StatusCodes } = require("http-status-codes");
const { param } = require("../routes/openAPIRoute");

const getAllParametersController = async (req, res) => {
  try {
    const parameters = await SuperAdmin.getAllParameters();
    const formattedParameters = parameters[0].map((para) => ({
      paraKey: para.para_key,
      paraName: para.para_name,
      paraUnit: para.para_unit,
    }));
    res.status(StatusCodes.OK).json({
      success: true,
      data: formattedParameters,
    });
  } catch (error) {
    console.error("Error fetching parameters:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to fetch parameters",
      error: error.message || error,
    });
  }
};

const getTableStructureController = async (req, res) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Device ID is required",
      });
    }
    const tableStructure = await SuperAdmin.getTableStructure(deviceId);
    const formattedTableStructure = tableStructure[0]
      .map((col, index) => {
        if (
          col.Field === "_id" ||
          col.Field === "lg" ||
          col.Field === "lt" ||
          col.Field === "bv" ||
          col.Field === "ts_client" ||
          col.Field === "ts_server"
        ) {
          return;
        }
        return {
          id: index + 1,
          columnName: col.Field,
          type: col.Type.split("(")[0],
          size: col.Type.match(/\d+/)
            ? parseInt(col.Type.match(/\d+/)[0])
            : null,
          null: col.Null,
          key: col.Key,
          default: col.Default,
          extra: col.Extra,
        };
      })
      .filter(Boolean);

    res.status(StatusCodes.OK).json({
      success: true,
      data: formattedTableStructure,
    });
  } catch (error) {
    console.error("Error fetching table structure:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to fetch table structure",
      error: error.message || error,
    });
  }
};
const setTableStructureController = async (req, res) => {
  try {
    const { deviceId } = req.query;
    const columns = req.body;

    if (!deviceId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Device ID is required",
      });
    }

    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Column definitions must be a non-empty array",
      });
    }

    for (const col of columns) {
      if (!col.columnName || !col.type || !col.size || !col.after) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "Each column must have columnName, type, and size",
        });
      }
      const existingCols = await SuperAdmin.getExisting(deviceId);
      const existingColNames = existingCols.map((col) => col.Field);

      // Step 2: Filter out columns that already exist
      const newColumns = columns.filter(
        (col) => !existingColNames.includes(col.columnName)
      );

      if (newColumns.length === 0) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: "No new columns to add — all columns already exist",
          error: error.message || error,
        });
      }
      result = await SuperAdmin.setTableStructure(
        deviceId,
        col.columnName,
        col.type,
        col.size,
        col.after
      );
    }
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Table structure updated",
    });
  } catch (error) {
    console.error("Error updating table structure:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update table structure",
      error: error.message || error,
    });
  }
};

const deleteTableColumnController = async (req, res) => {
  try {
    const { deviceId } = req.query;
    const { columns } = req.body;

    if (!deviceId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Device ID is required",
      });
    }

    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Columns must be a non-empty array",
      });
    }

    const emptyColumns = [];
    const nonEmptyColumns = [];

    for (const col of columns) {
      const [rows] = await SuperAdmin.checkColumns(deviceId, col);

      if (rows.length > 0) {
        nonEmptyColumns.push(col);
      } else {
        emptyColumns.push(col);
      }
    }

    if (emptyColumns.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "No empty columns found to delete",
        nonEmptyColumns,
      });
    }

    // ✅ Only delete the empty ones
    const result = await SuperAdmin.DeleteTableColumns(deviceId, emptyColumns);

    res.status(StatusCodes.OK).json({
      success: true,
      message:
        nonEmptyColumns.length > 0
          ? `These columns have data: ${nonEmptyColumns.join(", ")}`
          : "Parameters Deleted Successfully",
    });
  } catch (error) {
    console.error("Error deleting table columns:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to delete table columns",
      error: error.message || error,
    });
  }
};

const updateColumnController = async (req, res) => {
  try {
    const { deviceId } = req.query;
    const columns = req.body; // expecting array

    if (!deviceId || !Array.isArray(columns) || columns.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Device ID and an array of columns are required",
      });
    }

    const result = await SuperAdmin.alterColumns(deviceId, columns);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Columns updated successfully",
    });
  } catch (error) {
    console.error("Error updating column size:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update column sizes",
      error: error.message || error,
    });
  }
};

const changeSequenceController = async (req, res) => {
  try {
    const { deviceId } = req.query;
    const columns = req.body;

    for (const col of columns) {
      if (!col.columnName || !col.id) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "Each column must have columnName and id",
        });
      }
      const tableStructure = await SuperAdmin.getTableStructure(deviceId);
      const result = tableStructure[0].map((col, index) => ({
        id: index + 1,
        columnName: col.Field,
        type: col.Type,
      }));
      const matched = result.find((tab) => tab.columnName === col.columnName);
      let after;
      if (matched.id > col.id) {
        after = result.find((tab) => tab.id === col.id - 1);
      } else if (matched.id < col.id) {
        after = result.find((tab) => tab.id === col.id);
      } else {
        after = null;
      }
      if (after != null) {
        const position = await SuperAdmin.changePositions(
          deviceId,
          col.columnName,
          matched.type,
          after.columnName
        );
      }
    }
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Sequence Chnaged successfully",
    });
  } catch (error) {
    console.error("Failed to Fetch Position", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to Fetch Position",
      error: error.message || error,
    });
  }
};

const setMultipleTableStructureController = async (req, res) => {
  try {
    const { deviceId } = req.query;
    const { newDeviceIds } = req.body;
    const emptyDeviceIds = [];
    const nonEmptyDeviceIds = [];
    const nonExistingDeviceIds = [];
    if (!deviceId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Device Id is required `,
      });
    }
    if (!Array.isArray(newDeviceIds) || newDeviceIds.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Provide at least one device ID to set structure`,
      });
    }
    for (const device of newDeviceIds) {
      const existing = await Admin.checkDevice(device);
      console.log("ex", existing[0][0]);
      if (existing[0][0] !== undefined) {
        const checkDeviceId = await SuperAdmin.checkDeviceTable(device);
        if (checkDeviceId[0][0] === undefined) {
          emptyDeviceIds.push(device);
        } else {
          nonEmptyDeviceIds.push(device);
        }
      } else {
        nonExistingDeviceIds.push(device);
        console.log("nonexisting", nonExistingDeviceIds);
      }
    }

    const setStructure = await SuperAdmin.setMultipleTableStructure(
      deviceId,
      emptyDeviceIds
    );

    if (nonEmptyDeviceIds.length > 0 && nonExistingDeviceIds.length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `These device IDs already have data: ${nonEmptyDeviceIds.join(
          ", "
        )} \n Invalid Device Ids: ${nonExistingDeviceIds.join(", ")}`,
      });
    }
    if (nonEmptyDeviceIds.length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `These device IDs already have data: ${nonEmptyDeviceIds.join(
          ", "
        )}`,
      });
    }
    if (nonExistingDeviceIds.length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Invalid Device Ids: ${nonExistingDeviceIds.join(", ")}`,
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Multiple Tables Structure Set",
    });
  } catch (error) {
    console.error("Failed to set structure", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to Set Structure",
      error: error.message || error,
    });
  }
};

module.exports = {
  getAllParametersController,
  getTableStructureController,
  setTableStructureController,
  deleteTableColumnController,
  updateColumnController,
  changeSequenceController,
  setMultipleTableStructureController,
};
