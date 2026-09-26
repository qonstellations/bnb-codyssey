class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      Object.assign(this, data);
    }
  }
}

export { ApiResponse };
export default ApiResponse;
