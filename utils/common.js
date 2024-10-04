function getStatus(timestamp) {
    const currentTime = new Date();
    const providedTime = new Date(timestamp);
  
    // Calculate time difference in milliseconds
    const timeDifference = currentTime - providedTime;
  
    // Convert time difference to days and hours
    const millisecondsInADay = 1000 * 60 * 60 * 24;
    const daysDifference = timeDifference / millisecondsInADay;
  
    if (daysDifference > 3) {
      return "Offline";
    } else if (daysDifference <= 1) {
      return "Online";
    } else if (daysDifference > 1 && daysDifference <= 3) {
      return "Delayed";
    }
  }

  function validateEmail(email) {
    if (/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(email)) return true;
    return false;
  }
  
  function validateRequestBody(keys, requiredParams) {
    sortedKeys = Object.keys(keys).sort();
    if (sortedKeys.toString() == requiredParams.toString()) return true;
    return false;
  }


  module.exports={getStatus,validateEmail,validateRequestBody}